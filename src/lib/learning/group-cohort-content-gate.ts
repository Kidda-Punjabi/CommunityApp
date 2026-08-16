import "server-only";

import { UK_DISPLAY_TIMEZONE } from "@/lib/calendar/uk-display-time";
import { resolveCourseActor } from "@/lib/kids/course-actor";
import type { SupabaseClient } from "@supabase/supabase-js";

export type GroupCohortContentGate = {
  /** True when the student has a future-dated group cohort and content should be hidden. */
  gated: boolean;
  cohortId: string;
  startDate: string;
  /** e.g. "Your course opens on 27 August 2026" */
  message: string;
};

function utcCalendarDay(isoOrDate: string | Date): string | null {
  if (typeof isoOrDate === "string") {
    const day = isoOrDate.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
  }
  if (Number.isNaN(isoOrDate.getTime())) return null;
  return isoOrDate.toISOString().slice(0, 10);
}

/** e.g. "27 August 2026" from a YYYY-MM-DD calendar day. */
export function formatGroupCohortOpenDate(startDate: string): string {
  const day = utcCalendarDay(startDate);
  if (!day) return startDate;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}

function formatSessionTimeOfDay(weeklySessionStart: string | null, hasTime: boolean): string | null {
  if (!hasTime || !weeklySessionStart) return null;
  const start = new Date(weeklySessionStart);
  if (Number.isNaN(start.getTime())) return null;
  return start.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: UK_DISPLAY_TIMEZONE,
  });
}

export function buildGroupCohortOpensMessage(params: {
  startDate: string;
  weeklySessionStart?: string | null;
  weeklySessionHasTime?: boolean;
}): string {
  const dateLabel = formatGroupCohortOpenDate(params.startDate);
  const timeLabel = formatSessionTimeOfDay(
    params.weeklySessionStart ?? null,
    params.weeklySessionHasTime ?? false
  );
  if (timeLabel) {
    return `Your course opens on ${dateLabel} at ${timeLabel}`;
  }
  return `Your course opens on ${dateLabel}`;
}

/**
 * Render-time gate for group cohort courses: hide Learn content until
 * cohorts.start_date (calendar day). Does not affect course_access grants.
 * Only applies to delivery_mode = 'group' enrollments with a cohort_id.
 */
export async function resolveGroupCohortContentGate(
  supabase: SupabaseClient,
  userId: string,
  courseIds: string[],
  now: Date = new Date()
): Promise<GroupCohortContentGate | null> {
  if (courseIds.length === 0) return null;

  const actor = await resolveCourseActor(supabase, userId);
  const enrollmentQuery = supabase
    .from("course_enrollments")
    .select("id, course_id, delivery_mode, cohort_id")
    .in("course_id", courseIds)
    .eq("delivery_mode", "group")
    .not("cohort_id", "is", null);

  const { data: enrollments, error } =
    actor.kind === "kid"
      ? await enrollmentQuery.eq("kid_profile_id", actor.kidProfileId)
      : await enrollmentQuery.eq("user_id", userId);

  if (error) throw error;

  const cohortIds = [
    ...new Set(
      (enrollments ?? [])
        .map((row) => row.cohort_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  if (cohortIds.length === 0) return null;

  const { data: cohorts, error: cohortError } = await supabase
    .from("cohorts")
    .select("id, start_date, weekly_session_start, weekly_session_has_time")
    .in("id", cohortIds);

  if (cohortError) throw cohortError;

  const today = utcCalendarDay(now);
  if (!today) return null;

  // Prefer the soonest future start among matching group cohorts.
  let best: GroupCohortContentGate | null = null;

  for (const cohort of cohorts ?? []) {
    const rawStart = cohort.start_date as string | null;
    if (!rawStart) continue;
    const startDate = utcCalendarDay(rawStart);
    if (!startDate) continue;
    if (startDate <= today) continue;

    const message = buildGroupCohortOpensMessage({
      startDate,
      weeklySessionStart: (cohort.weekly_session_start as string | null) ?? null,
      weeklySessionHasTime: Boolean(cohort.weekly_session_has_time),
    });

    const candidate: GroupCohortContentGate = {
      gated: true,
      cohortId: cohort.id as string,
      startDate,
      message,
    };

    if (!best || startDate < best.startDate) {
      best = candidate;
    }
  }

  return best;
}
