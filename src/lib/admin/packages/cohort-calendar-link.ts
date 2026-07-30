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

  const seriesId = params.recurringEventId.trim();

  if (seriesId) {
    const { data: seriesRows, error: seriesLookupError } = await supabase
      .from("tutor_scheduled_sessions")
      .select("id, cohort_id")
      .eq("tutor_id", cohort.tutor_id)
      .eq("google_recurring_event_id", seriesId);

    if (seriesLookupError) return { ok: false, error: seriesLookupError.message };

    const conflict = (seriesRows ?? []).find(
      (row) => row.cohort_id && row.cohort_id !== params.cohortId
    );
    if (conflict) {
      return {
        ok: false,
        error: "This calendar series is already linked to a different cohort.",
      };
    }
  }

  const { linkRecurringSeriesSessionsFromGoogle } = await import(
    "@/lib/admin/packages/expand-recurring-calendar-link"
  );

  const result = await linkRecurringSeriesSessionsFromGoogle(supabase, {
    tutorId: cohort.tutor_id,
    courseId: cohort.course_id,
    seriesId,
    googleEventId: params.googleEventId,
    title: params.title,
    startsAt: params.startsAt,
    endsAt: params.endsAt,
    cohortId: params.cohortId,
    studentId: null,
    reschedulingAllowed: false,
  });

  if (!result.ok) {
    return { ok: false, error: result.error ?? "Failed to link calendar series." };
  }

  return { ok: true, linkedCount: result.linkedCount };
}

/**
 * Clears the internal cohort ↔ calendar link only. Does not create, update, or
 * delete anything on Google Calendar.
 *
 * Scope mirrors linkCohortRecurringCalendarEvent: whole recurring series via
 * google_recurring_event_id when present; otherwise the single google_event_id.
 */
export async function unlinkCohortRecurringCalendarEvent(
  supabase: SupabaseClient,
  params: { cohortId: string }
): Promise<{ ok: boolean; error?: string; unlinkedCount?: number }> {
  const { data: cohort, error: cohortError } = await supabase
    .from("cohorts")
    .select("id, tutor_id")
    .eq("id", params.cohortId)
    .maybeSingle();

  if (cohortError) return { ok: false, error: cohortError.message };
  if (!cohort?.tutor_id) return { ok: false, error: "Cohort has no tutor assigned." };

  const { data: linkedRows, error: linkedError } = await supabase
    .from("tutor_scheduled_sessions")
    .select("id, google_event_id, google_recurring_event_id")
    .eq("tutor_id", cohort.tutor_id)
    .eq("cohort_id", params.cohortId);

  if (linkedError) return { ok: false, error: linkedError.message };
  if (!linkedRows?.length) {
    // Already unlinked — idempotent success so re-link can proceed to link.
    return { ok: true, unlinkedCount: 0 };
  }

  const now = new Date().toISOString();
  const unlinkPatch = {
    cohort_id: null,
    match_method: "unmatched" as const,
    updated_at: now,
  };

  const seriesIds = [
    ...new Set(
      linkedRows
        .map((row) => row.google_recurring_event_id?.trim())
        .filter((id): id is string => Boolean(id))
    ),
  ];

  if (seriesIds.length > 0) {
    const { data: seriesRows, error: seriesLookupError } = await supabase
      .from("tutor_scheduled_sessions")
      .select("id, cohort_id")
      .eq("tutor_id", cohort.tutor_id)
      .in("google_recurring_event_id", seriesIds);

    if (seriesLookupError) return { ok: false, error: seriesLookupError.message };

    const updatable = (seriesRows ?? []).filter((row) => row.cohort_id === params.cohortId);
    if (updatable.length === 0) {
      return { ok: false, error: "No linked calendar sessions for this cohort." };
    }

    const { error: updateError } = await supabase
      .from("tutor_scheduled_sessions")
      .update(unlinkPatch)
      .in(
        "id",
        updatable.map((row) => row.id)
      );

    if (updateError) return { ok: false, error: updateError.message };
    return { ok: true, unlinkedCount: updatable.length };
  }

  // Single-instance fallback: unlink by google_event_id for this cohort's rows.
  const eventIds = [
    ...new Set(
      linkedRows
        .map((row) => row.google_event_id?.trim())
        .filter((id): id is string => Boolean(id))
    ),
  ];

  if (eventIds.length === 0) {
    return { ok: false, error: "Linked sessions are missing Google event ids." };
  }

  const { data: byEventRows, error: byEventError } = await supabase
    .from("tutor_scheduled_sessions")
    .select("id, cohort_id")
    .eq("tutor_id", cohort.tutor_id)
    .in("google_event_id", eventIds);

  if (byEventError) return { ok: false, error: byEventError.message };

  const updatable = (byEventRows ?? []).filter((row) => row.cohort_id === params.cohortId);
  if (updatable.length === 0) {
    return { ok: false, error: "No linked calendar sessions for this cohort." };
  }

  const { error: updateError } = await supabase
    .from("tutor_scheduled_sessions")
    .update(unlinkPatch)
    .in(
      "id",
      updatable.map((row) => row.id)
    );

  if (updateError) return { ok: false, error: updateError.message };
  return { ok: true, unlinkedCount: updatable.length };
}

/**
 * Unlink the current series (Supabase only), then run the existing link flow
 * against the newly selected event. Does not merge/overwrite in place.
 */
export async function relinkCohortRecurringCalendarEvent(
  supabase: SupabaseClient,
  params: {
    cohortId: string;
    googleEventId: string;
    recurringEventId: string;
    title: string;
    startsAt: string;
    endsAt: string;
  }
): Promise<{ ok: boolean; error?: string; unlinkedCount?: number; linkedCount?: number }> {
  const unlink = await unlinkCohortRecurringCalendarEvent(supabase, {
    cohortId: params.cohortId,
  });
  if (!unlink.ok) return { ok: false, error: unlink.error };

  const link = await linkCohortRecurringCalendarEvent(supabase, params);
  if (!link.ok) {
    return {
      ok: false,
      error: link.error ?? "Unlinked the previous series, but linking the new event failed.",
      unlinkedCount: unlink.unlinkedCount,
    };
  }

  return {
    ok: true,
    unlinkedCount: unlink.unlinkedCount,
    linkedCount: link.linkedCount,
  };
}
