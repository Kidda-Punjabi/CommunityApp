import type { SupabaseClient } from "@supabase/supabase-js";
import { listGoogleCalendarEvents } from "@/lib/calendar/google-calendar-api";
import { refreshGoogleAccessToken } from "@/lib/calendar/google-oauth";
import { loadTutorMatchCandidates } from "@/lib/calendar/load-match-candidates";
import { matchEventToStudents } from "@/lib/calendar/match-events";

type ConnectionRow = {
  tutor_id: string;
  google_account_email: string;
  calendar_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  sync_token: string | null;
};

async function getValidAccessToken(
  adminClient: SupabaseClient,
  connection: ConnectionRow
): Promise<{ accessToken: string; refreshToken: string; expiresAt: string }> {
  const expiresAtMs = new Date(connection.token_expires_at).getTime();
  if (expiresAtMs > Date.now() + 60_000) {
    return {
      accessToken: connection.access_token,
      refreshToken: connection.refresh_token,
      expiresAt: connection.token_expires_at,
    };
  }

  const refreshed = await refreshGoogleAccessToken(connection.refresh_token);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  await adminClient
    .from("tutor_google_calendar_connections")
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token ?? connection.refresh_token,
      token_expires_at: newExpiresAt,
    })
    .eq("tutor_id", connection.tutor_id);

  return {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? connection.refresh_token,
    expiresAt: newExpiresAt,
  };
}

export async function syncTutorGoogleCalendar(
  adminClient: SupabaseClient,
  tutorId: string
): Promise<{ synced: number; unmatched: number }> {
  const { data: connection, error } = await adminClient
    .from("tutor_google_calendar_connections")
    .select("*")
    .eq("tutor_id", tutorId)
    .maybeSingle();

  if (error) throw error;
  if (!connection) throw new Error("Google Calendar is not connected.");

  const { accessToken } = await getValidAccessToken(adminClient, connection as ConnectionRow);
  const { events, nextSyncToken } = await listGoogleCalendarEvents(
    accessToken,
    connection.calendar_id,
    { syncToken: connection.sync_token }
  );

  const { students, cohorts } = await loadTutorMatchCandidates(adminClient, tutorId);

  let synced = 0;
  let unmatched = 0;

  for (const event of events) {
    const match = matchEventToStudents(event, students, cohorts);

    const row = {
      tutor_id: tutorId,
      google_event_id: event.id,
      student_id: match.studentId,
      cohort_id: match.cohortId,
      course_id: match.courseId,
      title: event.summary,
      starts_at: event.start,
      ends_at: event.end,
      meet_link: event.hangoutLink,
      location: event.location,
      attendee_emails: event.attendeeEmails,
      match_method: match.matchMethod,
      google_updated_at: event.updated ?? null,
      updated_at: new Date().toISOString(),
      status: "scheduled" as const,
    };

    const { data: existing } = await adminClient
      .from("tutor_scheduled_sessions")
      .select("id, rescheduling_allowed, match_method")
      .eq("tutor_id", tutorId)
      .eq("google_event_id", event.id)
      .maybeSingle();

    if (existing) {
      const updatePayload: Record<string, unknown> = { ...row };
      if (existing.match_method === "manual") {
        delete updatePayload.student_id;
        delete updatePayload.cohort_id;
        delete updatePayload.course_id;
        delete updatePayload.match_method;
      }

      await adminClient.from("tutor_scheduled_sessions").update(updatePayload).eq("id", existing.id);
    } else {
      await adminClient.from("tutor_scheduled_sessions").insert(row);
    }

    if (match.matchMethod === "unmatched") unmatched += 1;
    synced += 1;
  }

  await adminClient
    .from("tutor_google_calendar_connections")
    .update({
      last_synced_at: new Date().toISOString(),
      sync_token: nextSyncToken ?? connection.sync_token,
    })
    .eq("tutor_id", tutorId);

  return { synced, unmatched };
}

export async function upsertTutorGoogleConnection(
  adminClient: SupabaseClient,
  tutorId: string,
  params: {
    googleAccountEmail: string;
    accessToken: string;
    refreshToken: string;
    expiresInSeconds: number;
    calendarId?: string;
  }
): Promise<void> {
  const tokenExpiresAt = new Date(Date.now() + params.expiresInSeconds * 1000).toISOString();

  const { error } = await adminClient.from("tutor_google_calendar_connections").upsert(
    {
      tutor_id: tutorId,
      google_account_email: params.googleAccountEmail,
      calendar_id: params.calendarId ?? "primary",
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
      token_expires_at: tokenExpiresAt,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "tutor_id" }
  );

  if (error) throw error;
}
