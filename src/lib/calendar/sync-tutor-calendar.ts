import type { SupabaseClient } from "@supabase/supabase-js";
import { listGoogleCalendarEvents } from "@/lib/calendar/google-calendar-api";
import { refreshGoogleAccessToken } from "@/lib/calendar/google-oauth";
import { loadTutorMatchCandidates } from "@/lib/calendar/load-match-candidates";
import { matchEventToStudents } from "@/lib/calendar/match-events";
import { shouldImportLessonEvent } from "@/lib/calendar/lesson-filter";
import { isStudentOnAttendeeList } from "@/lib/calendar/session-visibility";
import type { TutorStudentMatchCandidate } from "@/lib/calendar/match-events";
import type { GoogleCalendarEvent } from "@/lib/calendar/types";

const DB_CHUNK_SIZE = 100;

type ConnectionRow = {
  tutor_id: string;
  google_account_email: string;
  calendar_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  sync_token: string | null;
};

type ExistingSessionRow = {
  id: string;
  google_event_id: string;
  rescheduling_allowed: boolean;
  match_method: string;
};

type SessionUpsertRow = {
  tutor_id: string;
  google_event_id: string;
  student_id: string | null;
  cohort_id: string | null;
  course_id: string | null;
  title: string;
  starts_at: string;
  ends_at: string;
  meet_link: string | null;
  location: string | null;
  attendee_emails: string[];
  match_method: string;
  google_updated_at: string | null;
  updated_at: string;
  status: "scheduled";
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

async function runInChunks<T>(
  items: T[],
  chunkSize: number,
  runChunk: (chunk: T[]) => Promise<void>
): Promise<void> {
  for (let index = 0; index < items.length; index += chunkSize) {
    await runChunk(items.slice(index, index + chunkSize));
  }
}

function buildSessionRow(
  tutorId: string,
  event: GoogleCalendarEvent,
  match: ReturnType<typeof matchEventToStudents>,
  updatedAt: string
): SessionUpsertRow {
  return {
    tutor_id: tutorId,
    google_event_id: event.id,
    student_id: match.studentId,
    cohort_id: match.studentId ? null : match.cohortId,
    course_id: match.courseId,
    title: event.summary,
    starts_at: event.start,
    ends_at: event.end,
    meet_link: event.hangoutLink,
    location: event.location,
    attendee_emails: event.attendeeEmails,
    match_method: match.matchMethod,
    google_updated_at: event.updated ?? null,
    updated_at: updatedAt,
    status: "scheduled",
  };
}

export async function syncTutorGoogleCalendar(
  adminClient: SupabaseClient,
  tutorId: string
): Promise<{ synced: number; skipped: number }> {
  const { data: connection, error } = await adminClient
    .from("tutor_google_calendar_connections")
    .select("*")
    .eq("tutor_id", tutorId)
    .maybeSingle();

  if (error) throw error;
  if (!connection) throw new Error("Google Calendar is not connected.");

  const [{ accessToken }, { students, cohorts }, { data: existingSessions, error: existingError }] =
    await Promise.all([
      getValidAccessToken(adminClient, connection as ConnectionRow),
      loadTutorMatchCandidates(adminClient, tutorId),
      adminClient
        .from("tutor_scheduled_sessions")
        .select("id, google_event_id, rescheduling_allowed, match_method")
        .eq("tutor_id", tutorId),
    ]);

  if (existingError) throw existingError;

  const existingByGoogleEventId = new Map(
    (existingSessions ?? []).map((session) => [
      session.google_event_id,
      session as ExistingSessionRow,
    ])
  );

  const { events, nextSyncToken } = await listGoogleCalendarEvents(
    accessToken,
    connection.calendar_id,
    { syncToken: connection.sync_token }
  );

  const updatedAt = new Date().toISOString();
  const toUpsert: SessionUpsertRow[] = [];
  const manualUpdates: Array<{ id: string; payload: Record<string, unknown> }> = [];
  const skippedGoogleEventIds: string[] = [];
  let synced = 0;
  let skipped = 0;

  for (const event of events) {
    const match = matchEventToStudents(event, students, cohorts);

    if (!shouldImportLessonEvent(event, match)) {
      skippedGoogleEventIds.push(event.id);
      skipped += 1;
      continue;
    }

    const existing = existingByGoogleEventId.get(event.id);
    const row = buildSessionRow(tutorId, event, match, updatedAt);

    if (existing?.match_method === "manual") {
      manualUpdates.push({
        id: existing.id,
        payload: {
          title: row.title,
          starts_at: row.starts_at,
          ends_at: row.ends_at,
          meet_link: row.meet_link,
          location: row.location,
          attendee_emails: row.attendee_emails,
          google_updated_at: row.google_updated_at,
          updated_at: row.updated_at,
        },
      });
    } else {
      toUpsert.push(row);
    }

    synced += 1;
  }

  await runInChunks(skippedGoogleEventIds, DB_CHUNK_SIZE, async (chunk) => {
    const { error: deleteError } = await adminClient
      .from("tutor_scheduled_sessions")
      .delete()
      .eq("tutor_id", tutorId)
      .in("google_event_id", chunk);
    if (deleteError) throw deleteError;
  });

  await runInChunks(toUpsert, DB_CHUNK_SIZE, async (chunk) => {
    const { error: upsertError } = await adminClient
      .from("tutor_scheduled_sessions")
      .upsert(chunk, { onConflict: "tutor_id,google_event_id" });
    if (upsertError) throw upsertError;
  });

  await runInChunks(manualUpdates, DB_CHUNK_SIZE, async (chunk) => {
    await Promise.all(
      chunk.map(async ({ id, payload }) => {
        const { error: updateError } = await adminClient
          .from("tutor_scheduled_sessions")
          .update(payload)
          .eq("id", id);
        if (updateError) throw updateError;
      })
    );
  });

  await cleanupStaleTutorSessions(adminClient, tutorId, students);

  await adminClient
    .from("tutor_google_calendar_connections")
    .update({
      last_synced_at: new Date().toISOString(),
      sync_token: nextSyncToken ?? connection.sync_token,
    })
    .eq("tutor_id", tutorId);

  return { synced, skipped };
}

async function cleanupStaleTutorSessions(
  adminClient: SupabaseClient,
  tutorId: string,
  students: TutorStudentMatchCandidate[]
) {
  const emailByStudentId = new Map(
    students.map((student) => [student.studentId, student.email.toLowerCase()])
  );

  const { data: sessions, error } = await adminClient
    .from("tutor_scheduled_sessions")
    .select("id, student_id, attendee_emails, match_method")
    .eq("tutor_id", tutorId);

  if (error) throw error;

  const staleIds = (sessions ?? [])
    .filter((session) => {
      if (session.match_method === "unmatched" || session.match_method === "title_name") {
        return true;
      }

      if (!session.student_id) return false;

      const studentEmail = emailByStudentId.get(session.student_id);
      if (!studentEmail) return true;

      return !isStudentOnAttendeeList(studentEmail, session.attendee_emails ?? []);
    })
    .map((session) => session.id);

  if (staleIds.length > 0) {
    await runInChunks(staleIds, DB_CHUNK_SIZE, async (chunk) => {
      const { error: deleteError } = await adminClient
        .from("tutor_scheduled_sessions")
        .delete()
        .in("id", chunk);
      if (deleteError) throw deleteError;
    });
  }

  await adminClient
    .from("tutor_scheduled_sessions")
    .update({ cohort_id: null })
    .eq("tutor_id", tutorId)
    .not("student_id", "is", null);
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
