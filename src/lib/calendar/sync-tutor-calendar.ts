import type { SupabaseClient } from "@supabase/supabase-js";
import { listGoogleCalendarEvents } from "@/lib/calendar/google-calendar-api";
import { isProtectedCalendarMatchMethod } from "@/lib/calendar/match-method";
import { refreshCohortSessionWeekNumbers } from "@/lib/calendar/cohort-session-week-number";
import { getValidTutorAccessToken } from "@/lib/calendar/tutor-access-token";
import { loadTutorMatchCandidates } from "@/lib/calendar/load-match-candidates";
import { matchEventToStudents } from "@/lib/calendar/match-events";
import type { CalendarExclusionRow } from "@/lib/calendar/exclusions";
import type { GoogleCalendarEvent } from "@/lib/calendar/types";
import { calendarSyncRangeStart } from "@/lib/calendar/constants";
import {
  planTutorCalendarWrites,
  type CalendarSessionSnapshot,
  type CarriedSessionFields,
} from "@/lib/calendar/plan-calendar-event-write";

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
  google_recurring_event_id: string | null;
  cohort_id: string | null;
  student_id: string | null;
  rescheduling_allowed: boolean;
  match_method: string | null;
  starts_at: string;
  lesson_id: string | null;
  lesson_assignment_status: string | null;
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
  lesson_id?: string | null;
  lesson_assignment_status?: "needs_assignment" | null;
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

function toSessionSnapshot(row: ExistingSessionRow): CalendarSessionSnapshot {
  return {
    id: row.id,
    googleEventId: row.google_event_id,
    googleRecurringEventId: row.google_recurring_event_id,
    cohortId: row.cohort_id,
    studentId: row.student_id,
    matchMethod: row.match_method,
    startsAt: row.starts_at,
    lessonId: row.lesson_id,
    lessonAssignmentStatus:
      row.lesson_assignment_status === "needs_assignment" ? "needs_assignment" : null,
    reschedulingAllowed: row.rescheduling_allowed,
  };
}

function applyCarriedSessionFields(
  row: SessionUpsertRow,
  carry: CarriedSessionFields | null
): SessionUpsertRow {
  if (!carry) return row;
  const cohortId = carry.cohortId;
  return {
    ...row,
    lesson_id: carry.lessonId,
    lesson_assignment_status: carry.lessonAssignmentStatus,
    match_method: carry.matchMethod,
    cohort_id: cohortId,
    student_id: cohortId ? null : carry.studentId,
    rescheduling_allowed: cohortId ? false : carry.reschedulingAllowed,
  };
}

function buildSessionRow(
  tutorId: string,
  event: GoogleCalendarEvent,
  match: ReturnType<typeof matchEventToStudents>,
  updatedAt: string,
  existing?: { rescheduling_allowed: boolean } | null
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
        .select(
          "id, google_event_id, google_recurring_event_id, cohort_id, student_id, rescheduling_allowed, match_method, starts_at, lesson_id, lesson_assignment_status"
        )
        .eq("tutor_id", tutorId),
    ]);

  if (existingError) throw existingError;

  const storedSessions = ((existingSessions ?? []) as ExistingSessionRow[]).map(toSessionSnapshot);

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
  const carriedUpserts: SessionUpsertRow[] = [];
  const inPlaceUpdates: Array<{ id: string; payload: Record<string, unknown> }> = [];
  const replacedSessionIds: string[] = [];
  const cohortIdsToRefresh = new Set<string>();
  const seenGoogleEventIds = new Set<string>();
  let synced = 0;
  const skipped = 0;

  const matchByEventId = new Map<string, ReturnType<typeof matchEventToStudents>>();
  const { plans, cancelledEventIdsToDelete } = planTutorCalendarWrites({
    events: events.map((event) => {
      const match = matchEventToStudents(event, students, cohorts);
      matchByEventId.set(event.id, match);
      return {
        id: event.id,
        start: event.start,
        recurringEventId: event.recurringEventId ?? null,
        matchCohortId: match.studentId ? null : match.cohortId,
        matchStudentId: match.studentId,
      };
    }),
    sessions: storedSessions,
    cancelledEventIds,
  });

  for (const plan of plans) {
    const event = events.find((item) => item.id === plan.eventId);
    const match = matchByEventId.get(plan.eventId);
    if (!event || !match) continue;

    if (plan.cohortId) cohortIdsToRefresh.add(plan.cohortId);
    seenGoogleEventIds.add(event.id);
    synced += 1;

    if (plan.action === "update-in-place") {
      inPlaceUpdates.push({
        id: plan.sessionId,
        payload: {
          google_event_id: event.id,
          title: event.summary,
          starts_at: event.start,
          ends_at: event.end,
          meet_link: event.hangoutLink ?? null,
          location: event.location ?? null,
          attendee_emails: event.attendeeEmails,
          google_recurring_event_id: event.recurringEventId ?? null,
          google_updated_at: event.updated ?? null,
          updated_at: updatedAt,
        },
      });
      continue;
    }

    const stored = storedSessions.find((session) => session.googleEventId === event.id);
    const row = applyCarriedSessionFields(
      buildSessionRow(
        tutorId,
        event,
        match,
        updatedAt,
        stored ? { rescheduling_allowed: stored.reschedulingAllowed } : null
      ),
      plan.carry
    );
    if (plan.carry) carriedUpserts.push(row);
    else toUpsert.push(row);
    replacedSessionIds.push(...plan.deleteSessionIds);
  }

  console.info(
    `[calendar sync] tutor=${tutorId} events=${events.length} upsert=${toUpsert.length} carried=${carriedUpserts.length} inplace=${inPlaceUpdates.length} cancelled=${cancelledEventIdsToDelete.length} full=${isFullSync}`
  );

  await runInChunks(inPlaceUpdates, DB_CHUNK_SIZE, async (chunk) => {
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

  if (replacedSessionIds.length > 0) {
    await runInChunks(replacedSessionIds, DB_CHUNK_SIZE, async (chunk) => {
      const { error: deleteError } = await adminClient
        .from("tutor_scheduled_sessions")
        .delete()
        .in("id", chunk);
      if (deleteError) throw deleteError;
    });
  }

  for (const rows of [toUpsert, carriedUpserts]) {
    await runInChunks(rows, DB_CHUNK_SIZE, async (chunk) => {
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
  }

  if (cancelledEventIdsToDelete.length > 0) {
    await runInChunks(cancelledEventIdsToDelete, DB_CHUNK_SIZE, async (chunk) => {
      const { error: deleteError } = await adminClient
        .from("tutor_scheduled_sessions")
        .delete()
        .eq("tutor_id", tutorId)
        .in("google_event_id", chunk);
      if (deleteError) throw deleteError;
    });
  }

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

// Deletes only. Inserts and protected-row retargets happen earlier in this function,
// so a retargeted row already carries the new google_event_id and is in seenGoogleEventIds.
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
        !isProtectedCalendarMatchMethod(session.match_method) &&
        !seenGoogleEventIds.has(session.google_event_id)
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
