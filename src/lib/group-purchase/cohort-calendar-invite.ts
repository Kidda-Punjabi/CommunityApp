import "server-only";

import { addAttendeeToGoogleCalendarEvent } from "@/lib/calendar/google-calendar-api";
import {
  getValidTutorAccessToken,
  type TutorCalendarConnectionRow,
} from "@/lib/calendar/tutor-access-token";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CohortCalendarGateResult =
  | { ready: true; tutorId: string; recurringEventId: string; calendarId: string }
  | { ready: false; reason: "no_tutor" | "no_recurring_event" | "no_connection" };

export async function evaluateCohortCalendarGate(
  supabase: SupabaseClient,
  cohortId: string,
  tutorId: string | null
): Promise<CohortCalendarGateResult> {
  if (!tutorId) {
    return { ready: false, reason: "no_tutor" };
  }

  const { data: session, error: sessionError } = await supabase
    .from("tutor_scheduled_sessions")
    .select("google_recurring_event_id")
    .eq("cohort_id", cohortId)
    .not("google_recurring_event_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  if (!session?.google_recurring_event_id) {
    return { ready: false, reason: "no_recurring_event" };
  }

  const { data: connection, error: connectionError } = await supabase
    .from("tutor_google_calendar_connections")
    .select(
      "tutor_id, google_account_email, calendar_id, access_token, refresh_token, token_expires_at"
    )
    .eq("tutor_id", tutorId)
    .maybeSingle();

  if (connectionError) {
    throw new Error(connectionError.message);
  }

  if (!connection) {
    return { ready: false, reason: "no_connection" };
  }

  return {
    ready: true,
    tutorId,
    recurringEventId: session.google_recurring_event_id as string,
    calendarId: connection.calendar_id as string,
  };
}

export async function trySendCohortCalendarInvite(
  supabase: SupabaseClient,
  params: {
    cohortId: string;
    tutorId: string | null;
    studentUserId: string;
  }
): Promise<{ calendarInvite: boolean; error?: string }> {
  const gate = await evaluateCohortCalendarGate(supabase, params.cohortId, params.tutorId);
  if (!gate.ready) {
    return { calendarInvite: false };
  }

  const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(
    params.studentUserId
  );
  if (authError) {
    return { calendarInvite: false, error: authError.message };
  }

  const studentEmail = authUser.user?.email?.trim();
  if (!studentEmail) {
    return { calendarInvite: false, error: "Student account has no email for calendar invite." };
  }

  const { data: connection, error: connectionError } = await supabase
    .from("tutor_google_calendar_connections")
    .select(
      "tutor_id, google_account_email, calendar_id, access_token, refresh_token, token_expires_at"
    )
    .eq("tutor_id", gate.tutorId)
    .maybeSingle();

  if (connectionError || !connection) {
    return { calendarInvite: false, error: connectionError?.message ?? "No calendar connection." };
  }

  try {
    const accessToken = await getValidTutorAccessToken(
      supabase,
      connection as TutorCalendarConnectionRow
    );

    await addAttendeeToGoogleCalendarEvent(
      accessToken,
      gate.calendarId,
      gate.recurringEventId,
      studentEmail
    );

    return { calendarInvite: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Calendar invite failed.";
    console.error("cohort calendar invite failed:", message);
    return { calendarInvite: false, error: message };
  }
}
