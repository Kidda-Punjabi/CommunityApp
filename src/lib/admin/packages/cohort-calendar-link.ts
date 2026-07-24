import "server-only";

import { listGoogleCalendarEvents } from "@/lib/calendar/google-calendar-api";
import {
  getValidTutorAccessToken,
  type TutorCalendarConnectionRow,
} from "@/lib/calendar/tutor-access-token";
import type { GoogleCalendarEvent } from "@/lib/calendar/types";
import {
  formatSessionTimeRangeUk,
  minutesOfDayInTimezone,
  UK_DISPLAY_TIMEZONE,
  weekdayNameInTimezone,
} from "@/lib/calendar/uk-display-time";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CohortCalendarCandidate = {
  googleEventId: string;
  recurringEventId: string;
  title: string;
  nextStartsAt: string;
  nextEndsAt: string;
  weekday: string;
  timeLabel: string;
  score: number;
  reasons: string[];
};

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function minutesOfDay(iso: string): number | null {
  return minutesOfDayInTimezone(iso, UK_DISPLAY_TIMEZONE);
}

function scoreEvent(params: {
  event: GoogleCalendarEvent;
  cohortName: string;
  courseName: string;
  startDayOfWeek: string | null;
  weeklySessionStart: string | null;
}): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const title = normalizeTitle(params.event.summary);
  const cohortNorm = normalizeTitle(params.cohortName);
  const courseNorm = normalizeTitle(params.courseName);

  if (cohortNorm && title.includes(cohortNorm)) {
    score += 50;
    reasons.push("Title matches cohort name");
  } else if (courseNorm && title.includes(courseNorm)) {
    score += 30;
    reasons.push("Title matches course name");
  } else if (
    title.includes("beginner") ||
    title.includes("group") ||
    title.includes("cohort") ||
    title.includes("punjabi")
  ) {
    score += 10;
    reasons.push("Title looks like a class");
  }

  const eventDay = weekdayNameInTimezone(params.event.start, UK_DISPLAY_TIMEZONE);
  if (params.startDayOfWeek && eventDay.toLowerCase() === params.startDayOfWeek.toLowerCase()) {
    score += 25;
    reasons.push(`Same weekday (${eventDay})`);
  }

  if (params.weeklySessionStart) {
    const target = minutesOfDay(params.weeklySessionStart);
    const actual = minutesOfDay(params.event.start);
    if (target != null && actual != null) {
      let diff = Math.abs(actual - target);
      if (diff > 12 * 60) diff = 24 * 60 - diff;
      if (diff <= 30) {
        score += 25;
        reasons.push("Within 30m of weekly session time");
      } else if (diff <= 60) {
        score += 15;
        reasons.push("Within 60m of weekly session time");
      }
    }
  }

  if (params.event.recurringEventId) {
    score += 5;
    reasons.push("Recurring series");
  }

  return { score, reasons };
}

function formatTimeLabel(startsAt: string, endsAt: string): string {
  return formatSessionTimeRangeUk(startsAt, endsAt);
}

export async function searchCohortCalendarCandidates(
  supabase: SupabaseClient,
  cohortId: string
): Promise<
  | { ok: true; candidates: CohortCalendarCandidate[]; state: "ok" | "no_tutor" | "no_connection" }
  | { ok: false; error: string }
> {
  const { data: cohort, error: cohortError } = await supabase
    .from("cohorts")
    .select(
      "id, name, tutor_id, course_id, start_day_of_week, weekly_session_start, courses(name)"
    )
    .eq("id", cohortId)
    .maybeSingle();

  if (cohortError) return { ok: false, error: cohortError.message };
  if (!cohort) return { ok: false, error: "Cohort not found." };
  if (!cohort.tutor_id) {
    return { ok: true, candidates: [], state: "no_tutor" };
  }

  const { data: connection, error: connectionError } = await supabase
    .from("tutor_google_calendar_connections")
    .select(
      "tutor_id, google_account_email, calendar_id, access_token, refresh_token, token_expires_at"
    )
    .eq("tutor_id", cohort.tutor_id)
    .maybeSingle();

  if (connectionError) return { ok: false, error: connectionError.message };
  if (!connection) {
    return { ok: true, candidates: [], state: "no_connection" };
  }

  const accessToken = await getValidTutorAccessToken(
    supabase,
    connection as TutorCalendarConnectionRow
  );

  const now = Date.now();
  const timeMin = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now + 56 * 24 * 60 * 60 * 1000).toISOString();

  const { events } = await listGoogleCalendarEvents(accessToken, connection.calendar_id, {
    timeMin,
    timeMax,
  });

  const { data: linkedElsewhere } = await supabase
    .from("tutor_scheduled_sessions")
    .select("google_recurring_event_id, cohort_id")
    .not("google_recurring_event_id", "is", null)
    .neq("cohort_id", cohortId);

  const takenSeries = new Set(
    (linkedElsewhere ?? [])
      .map((row) => row.google_recurring_event_id)
      .filter((id): id is string => Boolean(id))
  );

  const courseRel = Array.isArray(cohort.courses) ? cohort.courses[0] : cohort.courses;
  const courseName = (courseRel as { name?: string } | null)?.name ?? "";

  const bySeries = new Map<string, GoogleCalendarEvent>();
  for (const event of events) {
    const seriesId = event.recurringEventId ?? event.id;
    if (takenSeries.has(seriesId)) continue;
    const existing = bySeries.get(seriesId);
    if (!existing || event.start < existing.start) {
      bySeries.set(seriesId, event);
    }
  }

  const candidates: CohortCalendarCandidate[] = [];
  for (const [seriesId, event] of bySeries) {
    const { score, reasons } = scoreEvent({
      event,
      cohortName: cohort.name,
      courseName,
      startDayOfWeek: cohort.start_day_of_week,
      weeklySessionStart: cohort.weekly_session_start,
    });
    if (score < 10) continue;

    candidates.push({
      googleEventId: event.id,
      recurringEventId: seriesId,
      title: event.summary,
      nextStartsAt: event.start,
      nextEndsAt: event.end,
      weekday: weekdayNameInTimezone(event.start, UK_DISPLAY_TIMEZONE),
      timeLabel: formatTimeLabel(event.start, event.end),
      score,
      reasons,
    });
  }

  candidates.sort((a, b) => b.score - a.score || a.nextStartsAt.localeCompare(b.nextStartsAt));

  return { ok: true, candidates: candidates.slice(0, 12), state: "ok" };
}

export async function linkCohortRecurringCalendarEvent(
  supabase: SupabaseClient,
  params: {
    cohortId: string;
    googleEventId: string;
    recurringEventId: string;
    title: string;
    startsAt: string;
    endsAt: string;
  }
): Promise<{ ok: boolean; error?: string; linkedCount?: number }> {
  const { data: cohort, error: cohortError } = await supabase
    .from("cohorts")
    .select("id, tutor_id, course_id")
    .eq("id", params.cohortId)
    .maybeSingle();

  if (cohortError) return { ok: false, error: cohortError.message };
  if (!cohort?.tutor_id) return { ok: false, error: "Cohort has no tutor assigned." };

  const now = new Date().toISOString();
  const seriesId = params.recurringEventId.trim();
  const eventId = params.googleEventId.trim();

  // Prefer updating already-synced unmatched rows (unique on tutor_id, google_event_id).
  // "Link this event" links the whole recurring series — one admin click covers all instances.
  if (seriesId) {
    const { data: seriesRows, error: seriesLookupError } = await supabase
      .from("tutor_scheduled_sessions")
      .select("id, cohort_id, google_event_id")
      .eq("tutor_id", cohort.tutor_id)
      .eq("google_recurring_event_id", seriesId);

    if (seriesLookupError) return { ok: false, error: seriesLookupError.message };

    const updatable = (seriesRows ?? []).filter(
      (row) => !row.cohort_id || row.cohort_id === params.cohortId
    );

    if (updatable.length > 0) {
      const { error: updateError } = await supabase
        .from("tutor_scheduled_sessions")
        .update({
          cohort_id: params.cohortId,
          course_id: cohort.course_id,
          match_method: "manual",
          rescheduling_allowed: false,
          updated_at: now,
        })
        .in(
          "id",
          updatable.map((row) => row.id)
        );

      if (updateError) return { ok: false, error: updateError.message };
      return { ok: true, linkedCount: updatable.length };
    }
  }

  // Single-instance fallback: existing row for this google_event_id.
  const { data: byEvent, error: byEventError } = await supabase
    .from("tutor_scheduled_sessions")
    .select("id, cohort_id")
    .eq("tutor_id", cohort.tutor_id)
    .eq("google_event_id", eventId)
    .maybeSingle();

  if (byEventError) return { ok: false, error: byEventError.message };

  if (byEvent) {
    if (byEvent.cohort_id && byEvent.cohort_id !== params.cohortId) {
      return {
        ok: false,
        error: "This calendar event is already linked to a different cohort.",
      };
    }

    const { error: updateError } = await supabase
      .from("tutor_scheduled_sessions")
      .update({
        cohort_id: params.cohortId,
        course_id: cohort.course_id,
        google_recurring_event_id: seriesId || null,
        match_method: "manual",
        rescheduling_allowed: false,
        title: params.title,
        starts_at: params.startsAt,
        ends_at: params.endsAt,
        updated_at: now,
      })
      .eq("id", byEvent.id);

    if (updateError) return { ok: false, error: updateError.message };
    return { ok: true, linkedCount: 1 };
  }

  // No synced row yet — insert the visible instance (sync will fill later occurrences).
  const { error: insertError } = await supabase.from("tutor_scheduled_sessions").insert({
    tutor_id: cohort.tutor_id,
    cohort_id: params.cohortId,
    course_id: cohort.course_id,
    google_event_id: eventId,
    google_recurring_event_id: seriesId || null,
    title: params.title,
    starts_at: params.startsAt,
    ends_at: params.endsAt,
    match_method: "manual",
    status: "scheduled",
    rescheduling_allowed: false,
  });

  if (insertError) return { ok: false, error: insertError.message };
  return { ok: true, linkedCount: 1 };
}
