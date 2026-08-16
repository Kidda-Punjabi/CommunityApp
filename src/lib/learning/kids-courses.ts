import "server-only";

import { actorFilter, resolveCourseActor } from "@/lib/kids/course-actor";
import type { SupabaseClient } from "@supabase/supabase-js";

export const KIDS_CONTENT_TRACK = "kids";

export type KidsCourseSummary = {
  id: string;
  name: string;
};

/** Courses tagged content_track = 'kids' that the active actor can access. */
export async function fetchAccessibleKidsCourses(
  supabase: SupabaseClient,
  userId: string
): Promise<KidsCourseSummary[]> {
  const actor = await resolveCourseActor(supabase, userId);
  const filter = actorFilter(actor);
  const { data: accessRows, error: accessError } = await supabase
    .from("course_access")
    .select("course_id")
    .eq(filter.column, filter.value);

  if (accessError) throw accessError;

  const courseIds = [
    ...new Set(
      (accessRows ?? [])
        .map((row) => row.course_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  if (courseIds.length === 0) return [];

  const { data: courses, error } = await supabase
    .from("courses")
    .select("id, name")
    .eq("content_track", KIDS_CONTENT_TRACK)
    .in("id", courseIds)
    .order("display_order", { ascending: true });

  if (error) throw error;

  return (courses ?? []).map((course) => ({
    id: course.id as string,
    name: (course.name as string) || "Course",
  }));
}

export function kidsCourseLearnPath(courseId: string) {
  return `/dashboard/learn/kids/${courseId}`;
}
