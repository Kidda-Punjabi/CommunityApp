import {
  getCourseRequiredTier,
  type CourseTierSource,
  type PaidCourseTier,
} from "./access";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CourseRecord = {
  id: string;
  name: string;
  required_tier?: string | null;
};

export async function fetchCourses(
  supabase: SupabaseClient
): Promise<CourseRecord[]> {
  const { data } = await supabase
    .from("courses")
    .select("id, name, required_tier")
    .order("display_order", { ascending: true });

  return data ?? [];
}

export function buildCourseNameMap(courses: CourseRecord[]) {
  return new Map(courses.map((course) => [course.id, course.name]));
}

export function buildCourseIdsByTier(
  courses: CourseRecord[]
): Map<PaidCourseTier, string[]> {
  const map = new Map<PaidCourseTier, string[]>();

  for (const course of courses) {
    const tier = getCourseRequiredTier(course as CourseTierSource);
    const list = map.get(tier) ?? [];
    list.push(course.id);
    map.set(tier, list);
  }

  return map;
}

const TIER_NAME_HINTS: Record<PaidCourseTier, string[]> = {
  foundational: ["foundational"],
  beginners: ["beginner", "beginners"],
  community: ["community"],
};

export function findCoursesForTier(courses: CourseRecord[], tier: PaidCourseTier) {
  const byTier = courses.filter(
    (course) => getCourseRequiredTier(course as CourseTierSource) === tier
  );
  if (byTier.length > 0) return byTier;

  const hints = TIER_NAME_HINTS[tier];
  return courses.filter((course) => {
    const name = course.name.toLowerCase();
    return hints.some((hint) => name.includes(hint));
  });
}

export function findCourseForTier(courses: CourseRecord[], tier: PaidCourseTier) {
  return findCoursesForTier(courses, tier)[0];
}

export function courseIdsForTiers(
  courses: CourseRecord[],
  tiers: Iterable<PaidCourseTier>
): Set<string> {
  const ids = new Set<string>();

  for (const tier of tiers) {
    for (const course of findCoursesForTier(courses, tier)) {
      ids.add(course.id);
    }
  }

  return ids;
}

export function courseNamesForIds(
  courses: CourseRecord[],
  courseIds: Set<string>
): string[] {
  const nameById = buildCourseNameMap(courses);
  return courses
    .filter((course) => courseIds.has(course.id))
    .map((course) => nameById.get(course.id) ?? course.name);
}
