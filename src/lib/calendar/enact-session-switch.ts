import "server-only";

import {
  addAttendeeToGoogleCalendarEvent,
  removeAttendeeFromGoogleCalendarEvent,
} from "@/lib/calendar/google-calendar-api";
import {
  getValidTutorAccessToken,
  type TutorCalendarConnectionRow,
} from "@/lib/calendar/tutor-access-token";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SessionSwitchEnactResult = {
  ok: boolean;
  error?: string;
  originalAttendeeEmails?: string[];
  targetAttendeeEmails?: string[];
  sessionSwitchesUsed?: number;
  alreadySynced?: boolean;
};

type SessionRow = {
  id: string;
  tutor_id: string;
  course_id: string | null;
  google_event_id: string | null;
  title: string;
  attendee_emails: string[] | null;
};

type ConnectionRow = TutorCalendarConnectionRow & { calendar_id: string };

function requireEventId(session: SessionRow, label: string): string {
  const eventId = session.google_event_id?.trim() ?? "";
  if (!eventId) {
    throw new Error(
      `${label} has no google_event_id, so the calendar event cannot be identified (session ${session.id}, “${session.title}”).`
    );
  }
  return eventId;
}

async function loadTutorConnection(
  supabase: SupabaseClient,
  tutorId: string,
  label: string
): Promise<ConnectionRow> {
  const { data, error } = await supabase
    .from("tutor_google_calendar_connections")
    .select(
      "tutor_id, google_account_email, calendar_id, access_token, refresh_token, token_expires_at"
    )
    .eq("tutor_id", tutorId)
    .maybeSingle();

  if (error) {
    throw new Error(`${label} calendar connection lookup failed: ${error.message}`);
  }
  if (!data) {
    throw new Error(
      `${label} tutor has no Google Calendar connection. Connect Calendar for that tutor, then retry.`
    );
  }
  if (!data.refresh_token?.trim()) {
    throw new Error(
      `${label} tutor’s Google Calendar connection is missing a refresh token. Reconnect Calendar, then retry.`
    );
  }
  if (!data.calendar_id?.trim()) {
    throw new Error(`${label} tutor’s Google Calendar connection has no calendar_id.`);
  }

  return data as ConnectionRow;
}

async function writeSyncError(
  supabase: SupabaseClient,
  requestId: string,
  message: string
): Promise<void> {
  const { error } = await supabase
    .from("cohort_switch_requests")
    .update({ sync_error: message })
    .eq("id", requestId)
    .is("calendar_synced_at", null);

  if (error) {
    console.error("[session-switch] failed to persist sync_error", {
      requestId,
      message,
      error: error.message,
    });
  }
}

async function updateSessionAttendees(
  supabase: SupabaseClient,
  sessionId: string,
  attendeeEmails: string[]
): Promise<void> {
  const { error } = await supabase
    .from("tutor_scheduled_sessions")
    .update({
      attendee_emails: attendeeEmails,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    console.error("[session-switch] failed to write attendee_emails", {
      sessionId,
      error: error.message,
    });
  }
}

/**
 * Enact an approved session switch: remove the student from the original Google
 * event, add them to the target event, then increment session_switches_used.
 * Calendar work is idempotent; the used-count increment runs only when we are
 * the first writer of calendar_synced_at.
 */
export async function enactSessionSwitchApproval(
  requestId: string,
  supabase: SupabaseClient = createServiceRoleClient()
): Promise<SessionSwitchEnactResult> {
  const { data: request, error: requestError } = await supabase
    .from("cohort_switch_requests")
    .select(
      "id, status, student_id, session_id, to_session_id, calendar_synced_at, sync_error"
    )
    .eq("id", requestId)
    .maybeSingle();

  if (requestError || !request) {
    return { ok: false, error: requestError?.message ?? "Session switch request not found." };
  }

  if (request.status !== "approved") {
    return {
      ok: false,
      error: `Request status is “${request.status}”, not approved.`,
    };
  }

  if (request.calendar_synced_at) {
    return { ok: true, alreadySynced: true };
  }

  const toSessionId = (request.to_session_id as string | null)?.trim() ?? "";
  if (!toSessionId) {
    const error =
      "Approved request has no to_session_id — cannot identify the target class. Calendar was not changed.";
    await writeSyncError(supabase, requestId, error);
    return { ok: false, error };
  }

  const [{ data: originalSession, error: originalError }, { data: targetSession, error: targetError }] =
    await Promise.all([
      supabase
        .from("tutor_scheduled_sessions")
        .select("id, tutor_id, course_id, google_event_id, title, attendee_emails")
        .eq("id", request.session_id)
        .maybeSingle(),
      supabase
        .from("tutor_scheduled_sessions")
        .select("id, tutor_id, course_id, google_event_id, title, attendee_emails")
        .eq("id", toSessionId)
        .maybeSingle(),
    ]);

  if (originalError || !originalSession) {
    const error = `Original session not found (${request.session_id}). Calendar was not changed.`;
    await writeSyncError(supabase, requestId, error);
    return { ok: false, error };
  }
  if (targetError || !targetSession) {
    const error = `Target session not found (${toSessionId}). Calendar was not changed.`;
    await writeSyncError(supabase, requestId, error);
    return { ok: false, error };
  }

  const original = originalSession as SessionRow;
  const target = targetSession as SessionRow;

  let originalEventId: string;
  let targetEventId: string;
  try {
    originalEventId = requireEventId(original, "Original class");
    targetEventId = requireEventId(target, "Target class");
  } catch (e) {
    const error = e instanceof Error ? e.message : "Missing google_event_id.";
    await writeSyncError(supabase, requestId, error);
    return { ok: false, error };
  }

  if (!original.course_id) {
    const error = "Original session has no course_id, so session_switches_used cannot be incremented.";
    await writeSyncError(supabase, requestId, error);
    return { ok: false, error };
  }

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("course_enrollments")
    .select("id, session_switches_used")
    .eq("user_id", request.student_id)
    .eq("course_id", original.course_id)
    .maybeSingle();

  if (enrollmentError) {
    const error = `Enrollment lookup failed: ${enrollmentError.message}`;
    await writeSyncError(supabase, requestId, error);
    return { ok: false, error };
  }
  if (!enrollment) {
    const error =
      "No course_enrollments row for this student and course — calendar was not changed.";
    await writeSyncError(supabase, requestId, error);
    return { ok: false, error };
  }

  const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(
    request.student_id as string
  );
  const studentEmail = authUser.user?.email?.trim().toLowerCase() ?? "";
  if (authError || !studentEmail) {
    const error = "Student has no email, so calendar attendees cannot be updated.";
    await writeSyncError(supabase, requestId, error);
    return { ok: false, error };
  }

  let originalConnection: ConnectionRow;
  let targetConnection: ConnectionRow;
  try {
    originalConnection = await loadTutorConnection(
      supabase,
      original.tutor_id,
      "Original class"
    );
    targetConnection = await loadTutorConnection(supabase, target.tutor_id, "Target class");
  } catch (e) {
    const error = e instanceof Error ? e.message : "Tutor Calendar connection missing.";
    await writeSyncError(supabase, requestId, error);
    return { ok: false, error };
  }

  let originalToken: string;
  let targetToken: string;
  try {
    originalToken = await getValidTutorAccessToken(supabase, originalConnection);
  } catch (e) {
    const error = `Original tutor Google token refresh failed: ${e instanceof Error ? e.message : String(e)}. Calendar was not changed.`;
    await writeSyncError(supabase, requestId, error);
    return { ok: false, error };
  }
  try {
    targetToken = await getValidTutorAccessToken(supabase, targetConnection);
  } catch (e) {
    const error = `Target tutor Google token refresh failed: ${e instanceof Error ? e.message : String(e)}. Calendar was not changed.`;
    await writeSyncError(supabase, requestId, error);
    return { ok: false, error };
  }

  let originalAttendees: string[] | undefined;
  let removedFromOriginal = false;

  try {
    const removed = await removeAttendeeFromGoogleCalendarEvent(
      originalToken,
      originalConnection.calendar_id,
      originalEventId,
      studentEmail
    );
    originalAttendees = removed.attendeeEmails;
    removedFromOriginal = removed.changed;
    await updateSessionAttendees(supabase, original.id, removed.attendeeEmails);
  } catch (e) {
    const error = `Failed to remove student from the original class calendar: ${e instanceof Error ? e.message : String(e)}`;
    await writeSyncError(supabase, requestId, error);
    return { ok: false, error, originalAttendeeEmails: originalAttendees };
  }

  let targetAttendees: string[] | undefined;
  try {
    const added = await addAttendeeToGoogleCalendarEvent(
      targetToken,
      targetConnection.calendar_id,
      targetEventId,
      studentEmail
    );
    targetAttendees = added.attendeeEmails;
    await updateSessionAttendees(supabase, target.id, added.attendeeEmails);
  } catch (e) {
    const addError = e instanceof Error ? e.message : String(e);
    let rollbackNote = "Original class was left without this student.";
    if (removedFromOriginal) {
      try {
        const restored = await addAttendeeToGoogleCalendarEvent(
          originalToken,
          originalConnection.calendar_id,
          originalEventId,
          studentEmail
        );
        originalAttendees = restored.attendeeEmails;
        await updateSessionAttendees(supabase, original.id, restored.attendeeEmails);
        rollbackNote = "Rolled back: student was re-added to the original class.";
      } catch (rollbackError) {
        rollbackNote = `Rollback failed (student missing from original class): ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`;
      }
    }
    const error = `Removed from original class, but failed to add to the target class: ${addError}. ${rollbackNote}`;
    await writeSyncError(supabase, requestId, error);
    return {
      ok: false,
      error,
      originalAttendeeEmails: originalAttendees,
      targetAttendeeEmails: targetAttendees,
    };
  }

  const syncedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from("cohort_switch_requests")
    .update({
      calendar_synced_at: syncedAt,
      sync_error: null,
      resolved_at: syncedAt,
    })
    .eq("id", requestId)
    .eq("status", "approved")
    .is("calendar_synced_at", null)
    .select("id")
    .maybeSingle();

  if (claimError) {
    const error = `Calendar updated, but failed to mark the request synced: ${claimError.message}`;
    await writeSyncError(supabase, requestId, error);
    return {
      ok: false,
      error,
      originalAttendeeEmails: originalAttendees,
      targetAttendeeEmails: targetAttendees,
    };
  }

  if (!claimed) {
    return {
      ok: true,
      alreadySynced: true,
      originalAttendeeEmails: originalAttendees,
      targetAttendeeEmails: targetAttendees,
    };
  }

  const { data: incremented, error: incrementError } = await supabase
    .from("course_enrollments")
    .update({
      session_switches_used: (enrollment.session_switches_used ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", enrollment.id)
    .select("session_switches_used")
    .maybeSingle();

  if (incrementError || incremented == null) {
    const error = `Calendar updated, but session_switches_used increment failed: ${incrementError?.message ?? "no enrollment row updated"}.`;
    await supabase
      .from("cohort_switch_requests")
      .update({ sync_error: error })
      .eq("id", requestId);
    return {
      ok: false,
      error,
      originalAttendeeEmails: originalAttendees,
      targetAttendeeEmails: targetAttendees,
    };
  }

  return {
    ok: true,
    originalAttendeeEmails: originalAttendees,
    targetAttendeeEmails: targetAttendees,
    sessionSwitchesUsed: incremented.session_switches_used as number,
  };
}
