import "server-only";

import {
  GROUP_COHORT_OCCURRENCE_LOOKAHEAD_WEEKS,
  GROUP_COHORT_SESSION_COUNT,
  defaultIncludeOccurrence,
  hasExactLinkedSessionCount,
  occurrenceOnOrAfterDate,
  withAssignedWeekNumbers,
  type GroupCohortOccurrenceDraft,
  type GroupCohortOccurrenceWithWeek,
} from "@/lib/admin/packages/group-cohort-calendar-occurrences";
import {
  listGoogleCalendarEventInstances,
  listGoogleCalendarEvents,
  listGoogleCalendarRecurringMasters,
} from "@/lib/calendar/google-calendar-api";
import { isWeeklyRrule } from "@/lib/calendar/match-method";
import {
  getValidTutorAccessToken,
  type TutorCalendarConnectionRow,
} from "@/lib/calendar/tutor-access-token";
import {
  formatSessionTimeRangeUk,
  UK_DISPLAY_TIMEZONE,
  weekdayNameInTimezone,
} from "@/lib/calendar/uk-display-time";
import {
  isoFromDateInput,
  weekdayFromDateInput,
} from "@/lib/admin/package-schedule";
import type { PackageInstanceStatus } from "@/lib/admin/package-status";
import type { SupabaseClient } from "@supabase/supabase-js";

export type GroupCohortCalendarSeries = {
  recurringEventId: string;
  title: string;
  weekday: string;
  timeLabel: string;
  nextStartsAt: string;
  nextEndsAt: string;
  matchesIntendedSlot: boolean;
};

export type GroupCohortCalendarLinkInput = {
  recurringEventId: string;
  occurrences: Array<{
    googleEventId: string;
    startsAt: string;
    endsAt: string;
    title: string;
    meetLink: string | null;
    location: string | null;
    attendeeEmails: string[];
    included: boolean;
  }>;
};

async function loadTutorCalendarConnection(
  supabase: SupabaseClient,
  tutorId: string
): Promise<
  | { ok: true; connection: TutorCalendarConnectionRow; accessToken: string }
  | { ok: false; state: "no_connection"; error?: undefined }
  | { ok: false; state?: undefined; error: string }
> {
  const { data: connection, error } = await supabase
    .from("tutor_google_calendar_connections")
    .select(
      "tutor_id, google_account_email, calendar_id, access_token, refresh_token, token_expires_at"
    )
    .eq("tutor_id", tutorId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!connection) return { ok: false, state: "no_connection" };

  const row = connection as TutorCalendarConnectionRow;
  const accessToken = await getValidTutorAccessToken(supabase, row);
  return { ok: true, connection: row, accessToken };
}

function matchesIntendedSlot(params: {
  startsAt: string;
  startDate: string | null;
}): boolean {
  if (!params.startDate) return false;
  const intendedWeekday = weekdayFromDateInput(params.startDate);
  const eventDay = weekdayNameInTimezone(params.startsAt, UK_DISPLAY_TIMEZONE);
  if (intendedWeekday && eventDay.toLowerCase() !== intendedWeekday.toLowerCase()) {
    return false;
  }
  return true;
}

function seriesWindow(startDate: string | null): { timeMin: string; timeMax: string } {
  const fromMs = startDate
    ? new Date(`${startDate}T00:00:00.000Z`).getTime()
    : Date.now();
  const timeMin = new Date(fromMs - 14 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(
    fromMs + GROUP_COHORT_OCCURRENCE_LOOKAHEAD_WEEKS * 7 * 24 * 60 * 60 * 1000
  ).toISOString();
  return { timeMin, timeMax };
}

export async function searchTutorWeeklyCalendarSeries(
  supabase: SupabaseClient,
  tutorId: string,
  startDate: string | null
): Promise<
  | {
      ok: true;
      series: GroupCohortCalendarSeries[];
      matchingSlotCount: number;
      state: "ok" | "no_connection";
    }
  | { ok: false; error: string }
> {
  const connected = await loadTutorCalendarConnection(supabase, tutorId);
  if (!connected.ok) {
    if (connected.state === "no_connection") {
      return { ok: true, series: [], matchingSlotCount: 0, state: "no_connection" };
    }
    return { ok: false, error: connected.error };
  }

  const { timeMin, timeMax } = seriesWindow(startDate);

  let masters;
  let expanded;
  try {
    [masters, expanded] = await Promise.all([
      listGoogleCalendarRecurringMasters(
        connected.accessToken,
        connected.connection.calendar_id,
        { timeMin, timeMax }
      ),
      listGoogleCalendarEvents(connected.accessToken, connected.connection.calendar_id, {
        timeMin,
        timeMax,
      }),
    ]);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to read tutor Google Calendar.",
    };
  }

  const weeklyMasterIds = new Set(
    masters.filter((master) => isWeeklyRrule(master.recurrence)).map((master) => master.id)
  );
  const masterById = new Map(masters.map((master) => [master.id, master]));

  const instancesBySeries = new Map<string, string[]>();
  const firstInstanceBySeries = new Map<
    string,
    { title: string; start: string; end: string }
  >();
  for (const event of expanded.events) {
    const seriesId = event.recurringEventId;
    if (!seriesId) continue;
    const starts = instancesBySeries.get(seriesId) ?? [];
    starts.push(event.start);
    instancesBySeries.set(seriesId, starts);
    const existing = firstInstanceBySeries.get(seriesId);
    if (!existing || event.start < existing.start) {
      firstInstanceBySeries.set(seriesId, {
        title: event.summary,
        start: event.start,
        end: event.end,
      });
    }
  }

  function looksWeekly(seriesId: string): boolean {
    if (weeklyMasterIds.has(seriesId)) return true;
    const starts = [...(instancesBySeries.get(seriesId) ?? [])].sort();
    if (starts.length < 2) return false;
    const gapsDays: number[] = [];
    for (let index = 1; index < starts.length; index += 1) {
      gapsDays.push(
        (new Date(starts[index]).getTime() - new Date(starts[index - 1]).getTime()) /
          (24 * 60 * 60 * 1000)
      );
    }
    gapsDays.sort((a, b) => a - b);
    const median = gapsDays[Math.floor(gapsDays.length / 2)];
    return median >= 6 && median <= 8;
  }

  const seriesIds = new Set<string>([...weeklyMasterIds, ...instancesBySeries.keys()]);
  const series: GroupCohortCalendarSeries[] = [];
  for (const seriesId of seriesIds) {
    if (!looksWeekly(seriesId)) continue;
    const instance = firstInstanceBySeries.get(seriesId);
    const master = masterById.get(seriesId);
    const nextStartsAt = instance?.start ?? master?.start;
    const nextEndsAt = instance?.end ?? master?.end;
    if (!nextStartsAt || !nextEndsAt) continue;

    series.push({
      recurringEventId: seriesId,
      title: instance?.title ?? master?.summary ?? "Weekly class",
      weekday: weekdayNameInTimezone(nextStartsAt, UK_DISPLAY_TIMEZONE),
      timeLabel: formatSessionTimeRangeUk(nextStartsAt, nextEndsAt),
      nextStartsAt,
      nextEndsAt,
      matchesIntendedSlot: matchesIntendedSlot({
        startsAt: nextStartsAt,
        startDate,
      }),
    });
  }

  series.sort((a, b) => {
    if (a.matchesIntendedSlot !== b.matchesIntendedSlot) {
      return a.matchesIntendedSlot ? -1 : 1;
    }
    return a.nextStartsAt.localeCompare(b.nextStartsAt) || a.title.localeCompare(b.title);
  });

  const matchingSlotCount = series.filter((item) => item.matchesIntendedSlot).length;

  return { ok: true, series, matchingSlotCount, state: "ok" };
}

export async function fetchTutorWeeklySeriesOccurrences(
  supabase: SupabaseClient,
  params: { tutorId: string; recurringEventId: string; startDate: string }
): Promise<
  | { ok: true; occurrences: GroupCohortOccurrenceWithWeek[]; state: "ok" | "no_connection" }
  | { ok: false; error: string }
> {
  const startDate = params.startDate.trim();
  if (!startDate) return { ok: false, error: "Set the first-class date to list this series." };

  const connected = await loadTutorCalendarConnection(supabase, params.tutorId);
  if (!connected.ok) {
    if (connected.state === "no_connection") {
      return { ok: true, occurrences: [], state: "no_connection" };
    }
    return { ok: false, error: connected.error };
  }

  const timeMin = `${startDate}T00:00:00.000Z`;
  const timeMax = new Date(
    new Date(timeMin).getTime() +
      GROUP_COHORT_OCCURRENCE_LOOKAHEAD_WEEKS * 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  let events;
  try {
    events = await listGoogleCalendarEventInstances(
      connected.accessToken,
      connected.connection.calendar_id,
      params.recurringEventId,
      { timeMin, timeMax, maxResults: 40 }
    );
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to list calendar occurrences.",
    };
  }

  const drafts: GroupCohortOccurrenceDraft[] = [];
  let includedSoFar = 0;
  for (const event of events) {
    if (!occurrenceOnOrAfterDate(event.start, startDate)) continue;
    const included = defaultIncludeOccurrence(event.status, includedSoFar);
    if (included) includedSoFar += 1;
    drafts.push({
      googleEventId: event.id,
      recurringEventId: event.recurringEventId ?? params.recurringEventId,
      title: event.summary,
      startsAt: event.start,
      endsAt: event.end,
      meetLink: event.hangoutLink,
      location: event.location,
      attendeeEmails: event.attendeeEmails,
      status: event.status ?? "confirmed",
      included,
    });
  }

  return {
    ok: true,
    occurrences: withAssignedWeekNumbers(drafts),
    state: "ok",
  };
}

export function parseGroupCohortCalendarLink(
  input: GroupCohortCalendarLinkInput | null | undefined
):
  | {
      ok: true;
      included: Array<GroupCohortOccurrenceWithWeek & { weekNumber: number }>;
      recurringEventId: string;
    }
  | { ok: false; error: string } {
  if (!input?.recurringEventId.trim()) {
    return { ok: false, error: "Pick the tutor’s weekly class calendar series." };
  }
  if (!Array.isArray(input.occurrences) || input.occurrences.length === 0) {
    return { ok: false, error: "No calendar occurrences were confirmed." };
  }

  const drafts: GroupCohortOccurrenceDraft[] = input.occurrences.map((row) => ({
    googleEventId: row.googleEventId.trim(),
    recurringEventId: input.recurringEventId.trim(),
    title: row.title.trim() || "Lesson",
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    meetLink: row.meetLink,
    location: row.location,
    attendeeEmails: row.attendeeEmails ?? [],
    status: "confirmed",
    included: Boolean(row.included),
  }));

  if (drafts.some((row) => !row.googleEventId || !row.startsAt || !row.endsAt)) {
    return { ok: false, error: "Each included class must be a real calendar event." };
  }

  const numbered = withAssignedWeekNumbers(drafts);
  if (!hasExactLinkedSessionCount(numbered)) {
    const found = numbered.filter((row) => row.included).length;
    return {
      ok: false,
      error: `Link exactly ${GROUP_COHORT_SESSION_COUNT} classes (currently ${found}). Skip bank holidays without using a week number.`,
    };
  }

  const included = numbered.filter(
    (row): row is GroupCohortOccurrenceWithWeek & { weekNumber: number } =>
      row.included && row.weekNumber != null
  );

  const weekNumbers = included.map((row) => row.weekNumber);
  const unique = new Set(weekNumbers);
  if (unique.size !== GROUP_COHORT_SESSION_COUNT) {
    return { ok: false, error: "Week numbers must be 1–12 with no gaps or duplicates." };
  }
  for (let week = 1; week <= GROUP_COHORT_SESSION_COUNT; week += 1) {
    if (!unique.has(week)) {
      return { ok: false, error: "Week numbers must be 1–12 with no gaps or duplicates." };
    }
  }

  return { ok: true, included, recurringEventId: input.recurringEventId.trim() };
}

export async function countCohortCalendarLinkSessions(
  supabase: SupabaseClient,
  cohortId: string
): Promise<{ calendarLinkCount: number; error?: string }> {
  const { count, error } = await supabase
    .from("tutor_scheduled_sessions")
    .select("id", { count: "exact", head: true })
    .eq("cohort_id", cohortId)
    .eq("match_method", "calendar_link");

  if (error) return { calendarLinkCount: 0, error: error.message };
  return { calendarLinkCount: count ?? 0 };
}

export function cohortStatusRequiresFullCalendarLink(
  status: PackageInstanceStatus
): boolean {
  return status !== "pre_scheduling";
}

export async function insertGroupCohortCalendarLinkedSessions(
  supabase: SupabaseClient,
  params: {
    tutorId: string;
    cohortId: string;
    courseId: string;
    recurringEventId: string;
    included: Array<GroupCohortOccurrenceWithWeek & { weekNumber: number }>;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const eventIds = params.included.map((row) => row.googleEventId);
  const { data: existing, error: existingError } = await supabase
    .from("tutor_scheduled_sessions")
    .select("id, cohort_id, student_id, google_event_id")
    .eq("tutor_id", params.tutorId)
    .in("google_event_id", eventIds);

  if (existingError) return { ok: false, error: existingError.message };

  for (const row of existing ?? []) {
    if (row.cohort_id && row.cohort_id !== params.cohortId) {
      return {
        ok: false,
        error: "One of these calendar events is already linked to another cohort.",
      };
    }
    if (row.student_id) {
      return {
        ok: false,
        error: "One of these calendar events is already linked to a 1-1 student.",
      };
    }
  }

  const now = new Date().toISOString();
  const rows = params.included.map((occurrence) => ({
    tutor_id: params.tutorId,
    cohort_id: params.cohortId,
    student_id: null,
    course_id: params.courseId,
    google_event_id: occurrence.googleEventId,
    google_recurring_event_id: occurrence.recurringEventId || params.recurringEventId,
    title: occurrence.title,
    starts_at: occurrence.startsAt,
    ends_at: occurrence.endsAt,
    meet_link: occurrence.meetLink,
    location: occurrence.location,
    attendee_emails: occurrence.attendeeEmails,
    match_method: "calendar_link" as const,
    status: "scheduled" as const,
    rescheduling_allowed: false,
    week_number: occurrence.weekNumber,
    updated_at: now,
  }));

  const { error } = await supabase
    .from("tutor_scheduled_sessions")
    .upsert(rows, { onConflict: "tutor_id,google_event_id" });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export function scheduleFieldsFromIncludedOccurrences(
  included: Array<{ startsAt: string; endsAt: string; weekNumber: number }>
): {
  startDate: string | null;
  endDate: string | null;
  startDayOfWeek: string | null;
  weeklySessionStart: string;
  weeklySessionEnd: string;
} {
  const sorted = [...included].sort(
    (a, b) => a.weekNumber - b.weekNumber || a.startsAt.localeCompare(b.startsAt)
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return {
    startDate: isoFromDateInput(
      new Date(first.startsAt).toLocaleDateString("en-CA", { timeZone: UK_DISPLAY_TIMEZONE })
    ),
    endDate: isoFromDateInput(
      new Date(last.startsAt).toLocaleDateString("en-CA", { timeZone: UK_DISPLAY_TIMEZONE })
    ),
    startDayOfWeek: weekdayNameInTimezone(first.startsAt, UK_DISPLAY_TIMEZONE),
    weeklySessionStart: first.startsAt,
    weeklySessionEnd: first.endsAt,
  };
}
