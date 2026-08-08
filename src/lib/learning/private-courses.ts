import { isPublicLearnCourse, type CourseRecord } from "@/lib/membership/courses";
import type { CourseAccessContext } from "@/lib/membership/unlocked";
import type { LessonWithCourse } from "@/app/dashboard/learn/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const LEARN_ENGLISH_CONTENT_TRACK = "learn_english";

export type LearnEnglishCourse = CourseRecord & {
  content_track: string | null;
  is_home_course: boolean | null;
  lessonCount: number;
};

/**
 * Private (is_public = false) courses the current user may access via course_access.
 * Never hardcode course or user IDs — RLS + this join decide visibility.
 */
export async function fetchAccessiblePrivateCourses(
  supabase: SupabaseClient,
  userId: string
): Promise<CourseRecord[]> {
  const { data: accessRows, error: accessError } = await supabase
    .from("course_access")
    .select("course_id")
    .eq("user_id", userId);

  if (accessError || !accessRows?.length) return [];

  const courseIds = accessRows.map((row) => row.course_id as string);
  const { data: courses, error: coursesError } = await supabase
    .from("courses")
    .select("id, name, required_tier, is_public")
    .in("id", courseIds)
    .eq("is_public", false)
    .order("display_order", { ascending: true });

  if (coursesError) return [];
  return (courses ?? []) as CourseRecord[];
}

/**
 * Learn English courses for the English Learn tab (excludes the Home Foundations course).
 * Visibility: course_access ∩ content_track — same private-access pattern as elsewhere.
 */
export async function fetchLearnEnglishLearnCourses(
  supabase: SupabaseClient,
  userId: string
): Promise<LearnEnglishCourse[]> {
  const { data: accessRows, error: accessError } = await supabase
    .from("course_access")
    .select("course_id")
    .eq("user_id", userId);

  if (accessError || !accessRows?.length) return [];

  const courseIds = accessRows.map((row) => row.course_id as string);
  const { data: courses, error: coursesError } = await supabase
    .from("courses")
    .select(
      "id, name, required_tier, is_public, content_track, is_home_course, lessons(count)"
    )
    .in("id", courseIds)
    .eq("content_track", LEARN_ENGLISH_CONTENT_TRACK)
    .eq("is_home_course", false)
    .order("display_order", { ascending: true });

  if (coursesError || !courses) return [];

  return courses.map((course) => {
    const lessonCountRow = Array.isArray(course.lessons) ? course.lessons[0] : null;
    const lessonCount =
      lessonCountRow &&
      typeof lessonCountRow === "object" &&
      "count" in lessonCountRow &&
      typeof (lessonCountRow as { count: unknown }).count === "number"
        ? (lessonCountRow as { count: number }).count
        : 0;

    return {
      id: course.id as string,
      name: course.name as string,
      required_tier: (course.required_tier as string | null) ?? null,
      is_public: (course.is_public as boolean | null) ?? null,
      content_track: (course.content_track as string | null) ?? null,
      is_home_course: (course.is_home_course as boolean | null) ?? null,
      lessonCount,
    };
  });
}

export async function fetchAccessibleLearnEnglishCourseById(
  supabase: SupabaseClient,
  userId: string,
  courseId: string
): Promise<LearnEnglishCourse | null> {
  const { data: accessRow, error: accessError } = await supabase
    .from("course_access")
    .select("course_id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (accessError || !accessRow) return null;

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select(
      "id, name, required_tier, is_public, content_track, is_home_course, lessons(count)"
    )
    .eq("id", courseId)
    .eq("content_track", LEARN_ENGLISH_CONTENT_TRACK)
    .eq("is_home_course", false)
    .maybeSingle();

  if (courseError || !course) return null;

  const lessonCountRow = Array.isArray(course.lessons) ? course.lessons[0] : null;
  const lessonCount =
    lessonCountRow &&
    typeof lessonCountRow === "object" &&
    "count" in lessonCountRow &&
    typeof (lessonCountRow as { count: unknown }).count === "number"
      ? (lessonCountRow as { count: number }).count
      : 0;

  return {
    id: course.id as string,
    name: course.name as string,
    required_tier: (course.required_tier as string | null) ?? null,
    is_public: (course.is_public as boolean | null) ?? null,
    content_track: (course.content_track as string | null) ?? null,
    is_home_course: (course.is_home_course as boolean | null) ?? null,
    lessonCount,
  };
}

export function isPrivateAccessCourse(
  access: CourseAccessContext,
  courseId: string
): boolean {
  const course = access.courses.find((item) => item.id === courseId);
  if (!course) return false;
  return !isPublicLearnCourse(course);
}

export function filterLessonsForPrivateCourse(
  lessons: LessonWithCourse[],
  courseId: string
): LessonWithCourse[] {
  return lessons
    .filter((lesson) => lesson.course_id === courseId)
    .sort((a, b) => a.lesson_number - b.lesson_number);
}
