import { getCourseRequiredTier, type PaidCourseTier } from "@/lib/membership/access";
import type { CourseRecord } from "@/lib/membership/courses";
import { findCoursesForTier } from "@/lib/membership/courses";
import type { CourseAccessContext } from "@/lib/membership/unlocked";
import type { LearnTrack } from "@/lib/learning/learn-catalog";
import type { LessonWithCourse } from "@/app/dashboard/learn/types";

export { findCourseForTier } from "@/lib/membership/courses";

export function hasTierAccess(
  access: CourseAccessContext,
  tier: PaidCourseTier
): boolean {
  if (access.viewAs?.active && access.viewAs.tiers.includes(tier)) {
    return true;
  }

  const matchingCourses = findCoursesForTier(access.courses, tier);
  for (const course of matchingCourses) {
    if (access.unlockedCourseIds.has(course.id)) return true;
  }

  return false;
}

export function isLearnTrackUnlocked(
  track: LearnTrack,
  access: CourseAccessContext
): boolean {
  if (track.alwaysUnlocked) return true;
  if (!track.tier) return false;
  return hasTierAccess(access, track.tier);
}

export function filterLessonsForTrack(
  lessons: LessonWithCourse[],
  courses: CourseRecord[],
  tier: PaidCourseTier
) {
  const courseIds = new Set(findCoursesForTier(courses, tier).map((course) => course.id));

  if (courseIds.size === 0) return [];

  return lessons.filter((lesson) => courseIds.has(lesson.course_id));
}

export function lessonCountForTrack(
  lessons: LessonWithCourse[],
  courses: CourseRecord[],
  tier: PaidCourseTier
) {
  return filterLessonsForTrack(lessons, courses, tier).length;
}

export function canAccessLessonInContext(
  access: CourseAccessContext,
  lesson: { is_free: boolean; course_id: string }
): boolean {
  if (lesson.is_free) return true;
  if (access.unlockedCourseIds.has(lesson.course_id)) return true;

  const course = access.courses.find((item) => item.id === lesson.course_id);
  if (!course) return false;

  const tier = getCourseRequiredTier(course);
  return hasTierAccess(access, tier);
}

export function isCommunityCourseLesson(
  access: CourseAccessContext,
  courseId: string
): boolean {
  const course = access.courses.find((item) => item.id === courseId);
  if (!course) return false;
  return getCourseRequiredTier(course) === "community";
}

/** Community: course access unlocks every lesson. Foundational/Beginners use tutor unlock RPC. */
export function isLessonContentUnlockedForUser(
  access: CourseAccessContext,
  lesson: { course_id: string; is_free: boolean },
  rpcUnlocked?: boolean
): boolean {
  if (lesson.is_free) return true;

  if (isCommunityCourseLesson(access, lesson.course_id)) {
    return canAccessLessonInContext(access, lesson);
  }

  return rpcUnlocked ?? false;
}
