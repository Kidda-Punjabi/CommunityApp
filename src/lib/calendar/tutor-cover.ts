import "server-only";

import {
  addAttendeeToGoogleCalendarEvent,
  updateGoogleCalendarEventTimes,
} from "@/lib/calendar/google-calendar-api";
import {
  getValidTutorAccessToken,
  type TutorCalendarConnectionRow,
} from "@/lib/calendar/tutor-access-token";
import { loadTutorBusyBlocks } from "@/lib/tutoring/availability/load-availability";
import type { SupabaseClient } from "@supabase/supabase-js";

export const COVER_DECISION_WINDOW_MS = 48 * 60 * 60 * 1000;

export type CoverRequestStatus =
  | "pending_assignment"
  | "assigned"
  | "declined"
  | "confirmed"
  | "cancelled"
  | "needs_admin";

function overlaps(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

async function listTutorCandidateIds(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from("profile_roles")
    .select("user_id")
    .eq("role", "tutor");
  if (error) throw error;
  return [...new Set((data ?? []).map((row) => row.user_id as string))];
}

export async function findAvailableCoverTutor(
  supabase: SupabaseClient,
  params: {
    excludeTutorId: string;
    excludeTutorIds?: string[];
    startsAt: string;
    endsAt: string;
  }
): Promise<string | null> {
  const exclude = new Set([
    params.excludeTutorId,
    ...(params.excludeTutorIds ?? []),
  ]);
  const candidates = (await listTutorCandidateIds(supabase)).filter((id) => !exclude.has(id));
  if (candidates.length === 0) return null;

  const startMs = new Date(params.startsAt).getTime();
  const endMs = new Date(params.endsAt).getTime();
  const rangeStart = new Date(startMs - 60 * 60 * 1000).toISOString();
  const rangeEnd = new Date(endMs + 60 * 60 * 1000).toISOString();

  for (const tutorId of candidates) {
    const busy = await loadTutorBusyBlocks(supabase, tutorId, rangeStart, rangeEnd);
    const conflict = busy.some((block) =>
      overlaps(startMs, endMs, new Date(block.startsAt).getTime(), new Date(block.endsAt).getTime())
    );
    if (!conflict) return tutorId;
  }

  return null;
}

async function notifyAssignedTutor(
  supabase: SupabaseClient,
  params: {
    assignedTutorId: string;
    requestingTutorId: string;
    sessionId: string;
    sessionTitle: string;
    startsAt: string;
    deadline: string;
  }
): Promise<void> {
  try {
    await supabase.from("notifications").insert({
      user_id: params.assignedTutorId,
      type: "tutor_cover_assigned",
      actor_user_id: params.requestingTutorId,
      payload: {
        session_id: params.sessionId,
        session_title: params.sessionTitle,
        starts_at: params.startsAt,
        decision_deadline: params.deadline,
      },
    });
  } catch {
    // Non-fatal — assignment still stands
  }
}

async function inviteCoverTutorOnCalendar(
  supabase: SupabaseClient,
  params: {
    owningTutorId: string;
    coverTutorId: string;
    googleEventId: string;
  }
): Promise<{ emailed: boolean; error?: string }> {
  const [{ data: connection }, { data: coverUser }] = await Promise.all([
    supabase
      .from("tutor_google_calendar_connections")
      .select(
        "tutor_id, google_account_email, calendar_id, access_token, refresh_token, token_expires_at"
      )
      .eq("tutor_id", params.owningTutorId)
      .maybeSingle(),
    supabase.auth.admin.getUserById(params.coverTutorId),
  ]);

  if (!connection) {
    return { emailed: false, error: "Session tutor has no Google Calendar connected." };
  }

  const coverEmail = coverUser.user?.email?.trim().toLowerCase();
  if (!coverEmail) {
    return { emailed: false, error: "Cover tutor has no email." };
  }

  try {
    const accessToken = await getValidTutorAccessToken(
      supabase,
      connection as TutorCalendarConnectionRow
    );
    await addAttendeeToGoogleCalendarEvent(
      accessToken,
      connection.calendar_id as string,
      params.googleEventId,
      coverEmail
    );
    return { emailed: true };
  } catch (e) {
    return {
      emailed: false,
      error: e instanceof Error ? e.message : "Calendar invite failed.",
    };
  }
}

export async function assignCoverTutor(
  supabase: SupabaseClient,
  coverRequestId: string,
  options?: { excludeTutorIds?: string[] }
): Promise<{ ok: true; assignedTutorId: string | null; status: CoverRequestStatus } | { ok: false; error: string }> {
  const { data: request, error } = await supabase
    .from("tutor_cover_requests")
    .select("*, tutor_scheduled_sessions(*)")
    .eq("id", coverRequestId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!request) return { ok: false, error: "Cover request not found." };

  const session = Array.isArray(request.tutor_scheduled_sessions)
    ? request.tutor_scheduled_sessions[0]
    : request.tutor_scheduled_sessions;

  if (!session) return { ok: false, error: "Session not found." };

  const assignedTutorId = await findAvailableCoverTutor(supabase, {
    excludeTutorId: request.requesting_tutor_id,
    excludeTutorIds: options?.excludeTutorIds,
    startsAt: session.starts_at,
    endsAt: session.ends_at,
  });

  if (!assignedTutorId) {
    const { error: updateError } = await supabase
      .from("tutor_cover_requests")
      .update({
        status: "needs_admin",
        assigned_tutor_id: null,
        assigned_at: null,
        decision_deadline: null,
      })
      .eq("id", coverRequestId);
    if (updateError) return { ok: false, error: updateError.message };
    return { ok: true, assignedTutorId: null, status: "needs_admin" };
  }

  const now = new Date();
  const deadline = new Date(now.getTime() + COVER_DECISION_WINDOW_MS).toISOString();

  const { error: updateError } = await supabase
    .from("tutor_cover_requests")
    .update({
      status: "assigned",
      assigned_tutor_id: assignedTutorId,
      assigned_at: now.toISOString(),
      decision_deadline: deadline,
      decided_at: null,
      decline_reason: null,
      attempt_count: (request.attempt_count ?? 0) + 1,
    })
    .eq("id", coverRequestId);

  if (updateError) return { ok: false, error: updateError.message };

  await notifyAssignedTutor(supabase, {
    assignedTutorId,
    requestingTutorId: request.requesting_tutor_id,
    sessionId: session.id,
    sessionTitle: session.title ?? "Lesson",
    startsAt: session.starts_at,
    deadline,
  });

  if (session.google_event_id) {
    await inviteCoverTutorOnCalendar(supabase, {
      owningTutorId: session.tutor_id,
      coverTutorId: assignedTutorId,
      googleEventId: session.google_event_id,
    });
  }

  return { ok: true, assignedTutorId, status: "assigned" };
}

export async function createCoverRequest(
  supabase: SupabaseClient,
  params: {
    sessionId: string;
    requestingTutorId: string;
    reason?: string | null;
  }
): Promise<{ ok: true; requestId: string } | { ok: false; error: string }> {
  const { data: session, error: sessionError } = await supabase
    .from("tutor_scheduled_sessions")
    .select("*")
    .eq("id", params.sessionId)
    .maybeSingle();

  if (sessionError) return { ok: false, error: sessionError.message };
  if (!session) return { ok: false, error: "Session not found." };
  if (session.tutor_id !== params.requestingTutorId) {
    return { ok: false, error: "You can only request cover for your own sessions." };
  }
  if (session.status !== "scheduled") {
    return { ok: false, error: "This session is not scheduled." };
  }

  const { data: existing } = await supabase
    .from("tutor_cover_requests")
    .select("id, status")
    .eq("session_id", params.sessionId)
    .in("status", ["pending_assignment", "assigned", "confirmed"])
    .maybeSingle();

  if (existing) {
    return { ok: false, error: "A cover request is already open for this session." };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("tutor_cover_requests")
    .insert({
      session_id: params.sessionId,
      requesting_tutor_id: params.requestingTutorId,
      reason: params.reason?.trim() || null,
      status: "pending_assignment",
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return { ok: false, error: insertError?.message ?? "Failed to create cover request." };
  }

  const assign = await assignCoverTutor(supabase, inserted.id);
  if (!assign.ok) return assign;

  return { ok: true, requestId: inserted.id };
}

export async function declineCoverAssignment(
  supabase: SupabaseClient,
  params: {
    coverRequestId: string;
    tutorId: string;
    reason?: string | null;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: request, error } = await supabase
    .from("tutor_cover_requests")
    .select("*")
    .eq("id", params.coverRequestId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!request) return { ok: false, error: "Cover request not found." };
  if (request.status !== "assigned") {
    return { ok: false, error: "This cover assignment is no longer open to decline." };
  }
  if (request.assigned_tutor_id !== params.tutorId) {
    return { ok: false, error: "Only the assigned tutor can decline." };
  }
  if (
    request.decision_deadline &&
    new Date(request.decision_deadline).getTime() < Date.now()
  ) {
    return { ok: false, error: "The 48-hour decline window has closed." };
  }

  const declinedTutorId = request.assigned_tutor_id as string;

  const { error: updateError } = await supabase
    .from("tutor_cover_requests")
    .update({
      status: "declined",
      decided_at: new Date().toISOString(),
      decline_reason: params.reason?.trim() || null,
    })
    .eq("id", params.coverRequestId)
    .eq("status", "assigned");

  if (updateError) return { ok: false, error: updateError.message };

  // Reassign to someone else (exclude the decliner)
  const reassign = await assignCoverTutor(supabase, params.coverRequestId, {
    excludeTutorIds: [declinedTutorId],
  });
  if (!reassign.ok) return reassign;

  return { ok: true };
}

export async function autoConfirmExpiredCoverAssignments(
  supabase: SupabaseClient
): Promise<{ confirmed: number }> {
  const nowIso = new Date().toISOString();
  const { data: expired, error } = await supabase
    .from("tutor_cover_requests")
    .select("id")
    .eq("status", "assigned")
    .lt("decision_deadline", nowIso);

  if (error) throw error;

  let confirmed = 0;
  for (const row of expired ?? []) {
    const { error: updateError } = await supabase
      .from("tutor_cover_requests")
      .update({
        status: "confirmed",
        decided_at: nowIso,
      })
      .eq("id", row.id)
      .eq("status", "assigned");
    if (!updateError) confirmed += 1;
  }

  return { confirmed };
}

export async function applyRescheduleSlotToSession(
  supabase: SupabaseClient,
  params: {
    sessionId: string;
    startsAt: string;
    endsAt: string;
    timeZone?: string;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: session, error } = await supabase
    .from("tutor_scheduled_sessions")
    .select("*")
    .eq("id", params.sessionId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!session) return { ok: false, error: "Session not found." };

  const { error: updateError } = await supabase
    .from("tutor_scheduled_sessions")
    .update({
      starts_at: params.startsAt,
      ends_at: params.endsAt,
    })
    .eq("id", params.sessionId);

  if (updateError) return { ok: false, error: updateError.message };

  if (session.google_event_id) {
    const { data: connection } = await supabase
      .from("tutor_google_calendar_connections")
      .select(
        "tutor_id, google_account_email, calendar_id, access_token, refresh_token, token_expires_at"
      )
      .eq("tutor_id", session.tutor_id)
      .maybeSingle();

    if (connection) {
      try {
        const accessToken = await getValidTutorAccessToken(
          supabase,
          connection as TutorCalendarConnectionRow
        );
        await updateGoogleCalendarEventTimes(
          accessToken,
          connection.calendar_id as string,
          session.google_event_id,
          {
            startsAt: params.startsAt,
            endsAt: params.endsAt,
            timeZone: params.timeZone ?? "Europe/London",
          }
        );
      } catch (e) {
        return {
          ok: false,
          error:
            e instanceof Error
              ? `Session updated in app, but Google Calendar failed: ${e.message}`
              : "Session updated in app, but Google Calendar failed.",
        };
      }
    }
  }

  return { ok: true };
}
