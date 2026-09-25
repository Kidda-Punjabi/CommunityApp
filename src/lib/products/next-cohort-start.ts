import "server-only";

import type { PaidCourseTier } from "@/lib/membership/access";
import {
  formatNextCohortStartNote,
  isUpcomingCohortStart,
  utcToday,
} from "@/lib/products/next-cohort-start-note";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";

const UPCOMING_COHORT_STATUSES = ["recruiting", "in_progress"] as const;

/**
 * Next recruiting/in-progress cohort start for a public adult course tier.
 * Kids-track courses are ignored. Returns undefined when nothing is upcoming.
 */
export async function nextCohortStartNote(
  tier: PaidCourseTier,
  now: Date = new Date()
): Promise<string | undefined> {
  const admin = tryCreateServiceRoleClient().client;
  if (!admin) return undefined;

  const { data: courses, error: courseError } = await admin
    .from("courses")
    .select("id, content_track")
    .eq("required_tier", tier);

  if (courseError || !courses?.length) return undefined;

  const courseIds = courses
    .filter((course) => course.content_track !== "kids")
    .map((course) => course.id as string);
  if (courseIds.length === 0) return undefined;

  const today = utcToday(now);
  const { data: cohorts, error: cohortError } = await admin
    .from("cohorts")
    .select("start_date, status")
    .in("course_id", courseIds)
    .in("status", [...UPCOMING_COHORT_STATUSES])
    .order("start_date", { ascending: true });

  if (cohortError || !cohorts?.length) return undefined;

  const upcoming = cohorts.find((cohort) =>
    isUpcomingCohortStart(typeof cohort.start_date === "string" ? cohort.start_date : null, today)
  );

  return formatNextCohortStartNote(
    typeof upcoming?.start_date === "string" ? upcoming.start_date : null
  );
}
