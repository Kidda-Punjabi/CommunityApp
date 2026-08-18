import type { SupabaseClient } from "@supabase/supabase-js";
import { listGoogleCalendarEvents } from "@/lib/calendar/google-calendar-api";
import { refreshCohortSessionWeekNumbers } from "@/lib/calendar/cohort-session-week-number";
import { getValidTutorAccessToken } from "@/lib/calendar/tutor-access-token";
import { loadTutorMatchCandidates } from "@/lib/calendar/load-match-candidates";
import { matchEventToStudents } from "@/lib/calendar/match-events";
import type { CalendarExclusionRow } from "@/lib/calendar/exclusions";
import type { GoogleCalendarEvent } from "@/lib/calendar/types";
import { calendarSyncRangeStart } from "@/lib/calendar/constants";
import {
  removeReplacedRecurringInstance,
} from "@/lib/calendar/session-dedup";

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
  google_recurring_event_id: string | null;
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
  rescheduling_allowed: boolean;
};

async function getValidAccessToken(
  adminClient: SupabaseClient,
  connection: ConnectionRow
): Promise<{ accessToken: string; refreshToken: string; expiresAt: string }> {
  const accessToken = await getValidTutorAccessToken(adminClient, connection);
  return {
    accessToken,
    refreshToken: connection.refresh_token,
    expiresAt: connection.token_expires_at,
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
  updatedAt: string,
  existing?: ExistingSessionRow | null
): SessionUpsertRow {
  const cohortId = match.studentId ? null : match.cohortId;
  // Always set explicitly — PostgREST upserts omit defaults and null out missing
  // NOT NULL columns (this was leaving Arshdeep's sync stuck after unmatched events).
  const reschedulingAllowed = cohortId
    ? false
    : (existing?.rescheduling_allowed ?? true);
  return {
    tutor_id: tutorId,
    google_event_id: event.id,
    google_recurring_event_id: event.recurringEventId ?? null,
    student_id: match.studentId,
    cohort_id: cohortId,
    course_id: match.courseId,
    title: event.summary,
    starts_at: event.start,
    ends_at: event.end,
    meet_link: event.hangoutLink ?? null,
    location: event.location ?? null,
    attendee_emails: event.attendeeEmails,
    match_method: match.matchMethod,
    google_updated_at: event.updated ?? null,
    updated_at: updatedAt,
    status: "scheduled",
    rescheduling_allowed: reschedulingAllowed,
  };
}

export async function loadTutorCalendarExclusions(
  adminClient: SupabaseClient,
  tutorId: string
): Promise<CalendarExclusionRow[]> {
  const { data, error } = await adminClient
    .from("tutor_calendar_event_exclusions")
    .select("google_event_id, google_recurring_event_id, scope")
    .eq("tutor_id", tutorId);

  if (error) {
    if (error.code === "PGRST205" || error.message?.includes("tutor_calendar_event_exclusions")) {
      return [];
    }
    throw error;
  }

  return (data ?? []) as CalendarExclusionRow[];
}

export async function syncTutorGoogleCalendar(
  adminClient: SupabaseClient,
  tutorId: string,
  options?: { forceFullSync?: boolean }
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

  const syncToken = options?.forceFullSync ? null : connection.sync_token;
  const isFullSync = !syncToken;

  const { events, nextSyncToken, cancelledEventIds } = await listGoogleCalendarEvents(
    accessToken,
    connection.calendar_id,
    isFullSync
      ? { syncToken: null, timeMin: calendarSyncRangeStart(), timeMax: undefined }
      : { syncToken }
  );

  const updatedAt = new Date().toISOString();
  const toUpsert: SessionUpsertRow[] = [];
  const manualUpdates: Array<{ id: string; payload: Record<string, unknown> }> = [];
  const cohortIdsToRefresh = new Set<string>();
  const seenGoogleEventIds = new Set<string>();
  let synced = 0;
  const skipped = 0;

  if (cancelledEventIds.length > 0) {
    await runInChunks(cancelledEventIds, DB_CHUNK_SIZE, async (chunk) => {
      const { error: deleteError } = await adminClient
        .from("tutor_scheduled_sessions")
        .delete()
        .eq("tutor_id", tutorId)
        .in("google_event_id", chunk);
      if (deleteError) throw deleteError;
    });
  }

  for (const event of events) {
    const match = matchEventToStudents(event, students, cohorts);
    const existing = existingByGoogleEventId.get(event.id);
    const row = buildSessionRow(tutorId, event, match, updatedAt, existing);

    if (row.cohort_id) cohortIdsToRefresh.add(row.cohort_id);

    await removeReplacedRecurringInstance(adminClient, tutorId, event, match);

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
          google_recurring_event_id: row.google_recurring_event_id,
          google_updated_at: row.google_updated_at,
          updated_at: row.updated_at,
        },
      });
    } else {
      toUpsert.push(row);
    }

    seenGoogleEventIds.add(event.id);
    synced += 1;
  }

  console.info(
    `[calendar sync] tutor=${tutorId} events=${events.length} upsert=${toUpsert.length} manual=${manualUpdates.length} cancelled=${cancelledEventIds.length} full=${isFullSync}`
  );

  await runInChunks(toUpsert, DB_CHUNK_SIZE, async (chunk) => {
    const { error: upsertError } = await adminClient
      .from("tutor_scheduled_sessions")
      .upsert(chunk, { onConflict: "tutor_id,google_event_id" });
    if (upsertError) {
      console.error(
        `[calendar sync] upsert failed tutor=${tutorId}:`,
        upsertError.message
      );
      throw upsertError;
    }
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

  if (cohortIdsToRefresh.size > 0) {
    try {
      await refreshCohortSessionWeekNumbers(adminClient, [...cohortIdsToRefresh]);
    } catch (weekNumberError) {
      console.error(
        `[calendar sync] week_number refresh failed tutor=${tutorId}:`,
        weekNumberError instanceof Error ? weekNumberError.message : weekNumberError
      );
    }
  }

  // Mark sync complete as soon as session writes succeed so UI can't stay stuck
  // on "syncing" if reconcile (or sync_token write) fails afterwards.
  const syncedAt = new Date().toISOString();
  const { error: syncedAtError } = await adminClient
    .from("tutor_google_calendar_connections")
    .update({
      last_synced_at: syncedAt,
      sync_token: nextSyncToken ?? connection.sync_token,
    })
    .eq("tutor_id", tutorId);

  if (syncedAtError) {
    console.error(
      `[calendar sync] last_synced_at update failed tutor=${tutorId}:`,
      syncedAtError.message
    );
    throw syncedAtError;
  }

  if (isFullSync) {
    try {
      await reconcileRemovedCalendarEvents(adminClient, tutorId, seenGoogleEventIds);
    } catch (reconcileError) {
      console.error(
        `[calendar sync] reconcile failed tutor=${tutorId} (sessions already saved, last_synced_at=${syncedAt}):`,
        reconcileError instanceof Error ? reconcileError.message : reconcileError
      );
    }
  }

  console.info(
    `[calendar sync] complete tutor=${tutorId} synced=${synced} last_synced_at=${syncedAt}`
  );

  return { synced, skipped };
}

async function reconcileRemovedCalendarEvents(
  adminClient: SupabaseClient,
  tutorId: string,
  seenGoogleEventIds: Set<string>
) {
  const rangeStart = calendarSyncRangeStart();
  const { data: sessions, error } = await adminClient
    .from("tutor_scheduled_sessions")
    .select("id, google_event_id, match_method")
    .eq("tutor_id", tutorId)
    .eq("status", "scheduled")
    .gte("starts_at", rangeStart);

  if (error) throw error;

  const staleIds = (sessions ?? [])
    .filter(
      (session) =>
        session.match_method !== "manual" && !seenGoogleEventIds.has(session.google_event_id)
    )
    .map((session) => session.id);

  if (staleIds.length === 0) return;

  await runInChunks(staleIds, DB_CHUNK_SIZE, async (chunk) => {
    const { error: deleteError } = await adminClient
      .from("tutor_scheduled_sessions")
      .delete()
      .in("id", chunk);
    if (deleteError) throw deleteError;
  });
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
