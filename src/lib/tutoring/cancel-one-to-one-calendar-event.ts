import "server-only";

import { deleteGoogleCalendarEvent } from "@/lib/calendar/google-calendar-api";
import {
  getValidTutorAccessToken,
  type TutorCalendarConnectionRow,
} from "@/lib/calendar/tutor-access-token";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Live Google Calendar delete for 1-to-1 booking cancels.
 * OFF by default — dry-run only until explicitly enabled after review.
 *
 * Set ONE_TO_ONE_GOOGLE_CALENDAR_CANCEL_LIVE_DELETE=true to call events.delete.
 */
export function isOneToOneGoogleCalendarCancelLiveDeleteEnabled(): boolean {
  const raw = process.env.ONE_TO_ONE_GOOGLE_CALENDAR_CANCEL_LIVE_DELETE?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export type CancelOneToOneCalendarEventResult = {
  sessionId: string;
  mode: "dry_run" | "live";
  status: "dry_run_logged" | "cancelled" | "error" | "skipped";
  googleEventId: string | null;
  message: string;
};

type SessionRow = {
  id: string;
  tutor_id: string;
  student_id: string | null;
  cohort_id: string | null;
  google_event_id: string;
  google_recurring_event_id: string | null;
  starts_at: string;
  status: string;
};

async function setCalendarSyncState(
  admin: SupabaseClient,
  sessionId: string,
  status: "pending" | "dry_run_logged" | "cancelled" | "error",
  errorMessage: string | null
): Promise<void> {
  const { error } = await admin
    .from("tutor_scheduled_sessions")
    .update({
      calendar_sync_status: status,
      calendar_sync_error: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    console.error(
      "[one-to-one calendar cancel] failed to update calendar_sync_status:",
      error.message,
      "session=",
      sessionId,
      "intendedStatus=",
      status
    );
  }
}

/**
 * Best-effort Google Calendar cancel for a 1-to-1 tutor_scheduled_sessions row.
 * Only callable from the 1-to-1 booking cancel path (skips cohort-linked sessions).
 * Never targets google_recurring_event_id — only the single google_event_id instance.
 */
export async function cancelOneToOneSessionGoogleCalendarEvent(
  admin: SupabaseClient,
  sessionId: string
): Promise<CancelOneToOneCalendarEventResult> {
  const live = isOneToOneGoogleCalendarCancelLiveDeleteEnabled();
  const mode = live ? "live" : "dry_run";

  const { data: session, error: sessionError } = await admin
    .from("tutor_scheduled_sessions")
    .select(
      "id, tutor_id, student_id, cohort_id, google_event_id, google_recurring_event_id, starts_at, status"
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) {
    return {
      sessionId,
      mode,
      status: "error",
      googleEventId: null,
      message: sessionError.message,
    };
  }

  if (!session) {
    return {
      sessionId,
      mode,
      status: "skipped",
      googleEventId: null,
      message: "Session not found.",
    };
  }

  const row = session as SessionRow;

  // Cohort/group sessions are never cancelled via tutor_one_to_one_bookings.
  if (row.cohort_id) {
    return {
      sessionId,
      mode,
      status: "skipped",
      googleEventId: row.google_event_id,
      message: "Skipped cohort-linked session.",
    };
  }

  if (!row.google_event_id) {
    return {
      sessionId,
      mode,
      status: "skipped",
      googleEventId: null,
      message: "Session has no google_event_id.",
    };
  }

  const dryRunPayload = {
    action: "would_delete_google_calendar_event",
    googleEventId: row.google_event_id,
    // Explicitly never touch recurring series master via google_recurring_event_id.
    googleRecurringEventIdIgnored: row.google_recurring_event_id,
    sessionId: row.id,
    studentId: row.student_id,
    tutorId: row.tutor_id,
    scheduledStartsAt: row.starts_at,
    sessionStatus: row.status,
    liveDeleteEnabled: live,
  };

  if (!live) {
    console.info(
      "[one-to-one calendar cancel] DRY RUN — not calling Google events.delete:",
      JSON.stringify(dryRunPayload)
    );
    await setCalendarSyncState(admin, row.id, "dry_run_logged", JSON.stringify(dryRunPayload));
    return {
      sessionId: row.id,
      mode: "dry_run",
      status: "dry_run_logged",
      googleEventId: row.google_event_id,
      message: "Dry-run logged; Google Calendar event not deleted.",
    };
  }

  await setCalendarSyncState(admin, row.id, "pending", null);

  try {
    const { data: connection, error: connectionError } = await admin
      .from("tutor_google_calendar_connections")
      .select(
        "tutor_id, google_account_email, calendar_id, access_token, refresh_token, token_expires_at"
      )
      .eq("tutor_id", row.tutor_id)
      .maybeSingle();

    if (connectionError) {
      throw new Error(connectionError.message);
    }
    if (!connection) {
      throw new Error("Tutor has no Google Calendar connection.");
    }

    const accessToken = await getValidTutorAccessToken(
      admin,
      connection as TutorCalendarConnectionRow
    );

    const deleteResult = await deleteGoogleCalendarEvent(
      accessToken,
      connection.calendar_id as string,
      row.google_event_id
    );

    const successMessage =
      deleteResult === "already_gone"
        ? "Google Calendar event already missing (404/410 treated as success)."
        : "Google Calendar event deleted with sendUpdates=all.";

    console.info(
      "[one-to-one calendar cancel] LIVE delete ok:",
      JSON.stringify({
        ...dryRunPayload,
        action: "deleted_google_calendar_event",
        deleteResult,
      })
    );

    await setCalendarSyncState(admin, row.id, "cancelled", null);
    return {
      sessionId: row.id,
      mode: "live",
      status: "cancelled",
      googleEventId: row.google_event_id,
      message: successMessage,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calendar cancel failed.";
    console.error(
      "[one-to-one calendar cancel] LIVE delete failed (booking/credit already cancelled):",
      message,
      "session=",
      row.id
    );
    await setCalendarSyncState(admin, row.id, "error", message.slice(0, 2000));
    return {
      sessionId: row.id,
      mode: "live",
      status: "error",
      googleEventId: row.google_event_id,
      message,
    };
  }
}
