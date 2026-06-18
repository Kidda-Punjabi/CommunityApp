import {
  inferCourseTier,
  normalizeTier,
  type MembershipTier,
} from "./tiers";
import type { CourseRecord } from "./courses";
import { buildCourseIdsByTier } from "./courses";

export type CourseTierSource = {
  id: string;
  name: string;
  required_tier?: string | null;
};

export type PaidCourseTier = Exclude<MembershipTier, "free">;

export function getCourseRequiredTier(course: CourseTierSource): PaidCourseTier {
  const tier = course.required_tier
    ? normalizeTier(course.required_tier)
    : inferCourseTier(course.name);
  return tier === "free" ? "foundational" : tier;
}

export function buildCourseTierMap(
  courses: CourseTierSource[]
): Map<string, PaidCourseTier> {
  return new Map(
    courses.map((course) => [course.id, getCourseRequiredTier(course)])
  );
}

export function hasAccessToCourse(
  unlockedCourseIds: Set<string>,
  courseId: string
): boolean {
  return unlockedCourseIds.has(courseId);
}

export function canAccessLesson(
  unlockedCourseIds: Set<string>,
  lesson: { is_free: boolean; course_id: string }
): boolean {
  if (lesson.is_free) return true;
  return hasAccessToCourse(unlockedCourseIds, lesson.course_id);
}

export function canAccessEvent(
  unlockedCourseIds: Set<string>,
  event: { is_free: boolean; required_tier: string | null },
  courses: CourseRecord[]
): boolean {
  if (event.is_free) return true;
  if (!event.required_tier) return true;

  const required = normalizeTier(event.required_tier);
  if (required === "free") return true;

  const courseIdsByTier = buildCourseIdsByTier(courses);
  const matchingCourseIds = courseIdsByTier.get(required) ?? [];

  return matchingCourseIds.some((courseId) => unlockedCourseIds.has(courseId));
}

/** @deprecated Use hasAccessToCourse with course IDs */
export function hasCourseAccess(
  unlockedTiers: Set<PaidCourseTier>,
  requiredTier: PaidCourseTier
): boolean {
  return unlockedTiers.has(requiredTier);
}
