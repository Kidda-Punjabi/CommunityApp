import { isPublicLearnCourse, type CourseRecord } from "@/lib/membership/courses";
import type { CourseAccessContext } from "@/lib/membership/unlocked";
import type { LessonWithCourse } from "@/app/dashboard/learn/types";
import type { SupabaseClient } from "@supabase/supabase-js";

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
