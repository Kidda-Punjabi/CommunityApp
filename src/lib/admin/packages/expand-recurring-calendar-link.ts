import "server-only";

import { calendarSyncRangeEnd, calendarSyncRangeStart } from "@/lib/calendar/constants";
import { listGoogleCalendarEvents } from "@/lib/calendar/google-calendar-api";
import {
  getValidTutorAccessToken,
  type TutorCalendarConnectionRow,
} from "@/lib/calendar/tutor-access-token";
import type { GoogleCalendarEvent } from "@/lib/calendar/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchRecurringSeriesInstancesFromGoogle(
  supabase: SupabaseClient,
  tutorId: string,
  seriesId: string
): Promise<
  | { ok: true; events: GoogleCalendarEvent[]; calendarId: string }
  | { ok: false; error: string }
  | { ok: false; state: "no_connection" }
> {
  const { data: connection, error: connectionError } = await supabase
    .from("tutor_google_calendar_connections")
    .select(
      "tutor_id, google_account_email, calendar_id, access_token, refresh_token, token_expires_at"
    )
    .eq("tutor_id", tutorId)
    .maybeSingle();

  if (connectionError) return { ok: false, error: connectionError.message };
  if (!connection) return { ok: false, state: "no_connection" };

  const accessToken = await getValidTutorAccessToken(
    supabase,
    connection as TutorCalendarConnectionRow
  );

  const { events } = await listGoogleCalendarEvents(accessToken, connection.calendar_id, {
    timeMin: calendarSyncRangeStart(),
    timeMax: calendarSyncRangeEnd(),
  });

  const normalizedSeriesId = seriesId.trim();
  const seriesEvents = events.filter(
    (event) =>
      event.recurringEventId === normalizedSeriesId || event.id === normalizedSeriesId
  );

  return { ok: true, events: seriesEvents, calendarId: connection.calendar_id };
}

type LinkSessionRowParams = {
  tutorId: string;
  courseId: string;
  seriesId: string;
  event: GoogleCalendarEvent;
  cohortId: string | null;
  studentId: string | null;
  reschedulingAllowed: boolean;
};

async function upsertLinkedSessionRow(
  supabase: SupabaseClient,
  params: LinkSessionRowParams
): Promise<void> {
  const now = new Date().toISOString();
  const seriesId = params.seriesId.trim();

  const { error } = await supabase.from("tutor_scheduled_sessions").upsert(
    {
      tutor_id: params.tutorId,
      cohort_id: params.cohortId,
      student_id: params.studentId,
      course_id: params.courseId,
      google_event_id: params.event.id,
      google_recurring_event_id: params.event.recurringEventId ?? seriesId,
      title: params.event.summary,
      starts_at: params.event.start,
      ends_at: params.event.end,
      meet_link: params.event.hangoutLink ?? null,
      location: params.event.location ?? null,
      attendee_emails: params.event.attendeeEmails,
      match_method: "manual",
      status: "scheduled",
      rescheduling_allowed: params.reschedulingAllowed,
      updated_at: now,
    },
    { onConflict: "tutor_id,google_event_id" }
  );

  if (error) throw error;
}

function fallbackEventFromParams(params: {
  googleEventId: string;
  recurringEventId: string;
  title: string;
  startsAt: string;
  endsAt: string;
}): GoogleCalendarEvent {
  const seriesId = params.recurringEventId.trim();
  return {
    id: params.googleEventId.trim(),
    summary: params.title,
    start: params.startsAt,
    end: params.endsAt,
    hangoutLink: null,
    location: null,
    attendeeEmails: [],
    recurringEventId: seriesId || null,
    status: "confirmed",
    updated: null,
  };
}

/**
 * Pull every expanded instance of a recurring series from Google Calendar and
 * upsert linked tutor_scheduled_sessions rows (not just the next occurrence).
 */
export async function linkRecurringSeriesSessionsFromGoogle(
  supabase: SupabaseClient,
  params: {
    tutorId: string;
    courseId: string;
    seriesId: string;
    googleEventId: string;
    title: string;
    startsAt: string;
    endsAt: string;
    cohortId: string | null;
    studentId: string | null;
    reschedulingAllowed: boolean;
  }
): Promise<{ ok: boolean; error?: string; linkedCount?: number; state?: "no_connection" }> {
  const seriesId = params.seriesId.trim();

  let events: GoogleCalendarEvent[] = [];
  if (seriesId) {
    const fetched = await fetchRecurringSeriesInstancesFromGoogle(
      supabase,
      params.tutorId,
      seriesId
    );
    if (!fetched.ok) {
      if ("state" in fetched && fetched.state === "no_connection") {
        return { ok: false, state: "no_connection", error: "Tutor has no Google Calendar connection." };
      }
      return { ok: false, error: "error" in fetched ? fetched.error : "Calendar fetch failed." };
    }
    events = fetched.events;
  }

  if (events.length === 0) {
    events = [
      fallbackEventFromParams({
        googleEventId: params.googleEventId,
        recurringEventId: params.seriesId,
        title: params.title,
        startsAt: params.startsAt,
        endsAt: params.endsAt,
      }),
    ];
  }

  for (const event of events) {
    await upsertLinkedSessionRow(supabase, {
      tutorId: params.tutorId,
      courseId: params.courseId,
      seriesId: seriesId || event.id,
      event,
      cohortId: params.cohortId,
      studentId: params.studentId,
      reschedulingAllowed: params.reschedulingAllowed,
    });
  }

  return { ok: true, linkedCount: events.length };
}

/** Re-pull all instances for an already-linked recurring series from Google Calendar. */
export async function refreshLinkedRecurringSeries(
  supabase: SupabaseClient,
  params: {
    tutorId: string;
    courseId: string;
    seriesId: string;
    cohortId: string | null;
    studentId: string | null;
    reschedulingAllowed: boolean;
  }
): Promise<{ ok: boolean; error?: string; linkedCount?: number }> {
  const { data: sample } = await supabase
    .from("tutor_scheduled_sessions")
    .select("google_event_id, title, starts_at, ends_at")
    .eq("tutor_id", params.tutorId)
    .eq("google_recurring_event_id", params.seriesId.trim())
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!sample?.google_event_id) {
    return { ok: false, error: "No linked calendar series found to refresh." };
  }

  return linkRecurringSeriesSessionsFromGoogle(supabase, {
    tutorId: params.tutorId,
    courseId: params.courseId,
    seriesId: params.seriesId,
    googleEventId: sample.google_event_id,
    title: sample.title,
    startsAt: sample.starts_at,
    endsAt: sample.ends_at,
    cohortId: params.cohortId,
    studentId: params.studentId,
    reschedulingAllowed: params.reschedulingAllowed,
  });
}
