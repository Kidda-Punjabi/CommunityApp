import "server-only";

import { resolveCourseActor, studentActorFilter } from "@/lib/kids/course-actor";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Per-lesson tutor homework marks from `cohort_lesson_homework.completed`
 * for the student's group cohort enrollment.
 */
export async function loadStudentCohortHomeworkCompletedMap(
  supabase: SupabaseClient,
  userId: string,
  courseIds: string[],
  lessonIds: string[]
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (courseIds.length === 0 || lessonIds.length === 0) return map;

  const actor = await resolveCourseActor(supabase, userId);
  const enrollmentQuery = supabase
    .from("course_enrollments")
    .select("cohort_id")
    .in("course_id", courseIds)
    .eq("delivery_mode", "group")
    .not("cohort_id", "is", null);

  const { data: enrollment, error: enrollmentError } =
    actor.kind === "kid"
      ? await enrollmentQuery.eq("kid_profile_id", actor.kidProfileId).maybeSingle()
      : await enrollmentQuery.eq("user_id", userId).maybeSingle();

  if (enrollmentError) {
    console.error(
      "loadStudentCohortHomeworkCompletedMap enrollment:",
      enrollmentError.message
    );
    return map;
  }

  const cohortId = enrollment?.cohort_id as string | null;
  if (!cohortId) return map;

  const studentFilter = studentActorFilter(actor);
  const { data, error } = await supabase
    .from("cohort_lesson_homework")
    .select("lesson_id, completed")
    .eq("cohort_id", cohortId)
    .eq(studentFilter.column, studentFilter.value)
    .in("lesson_id", lessonIds);

  if (error) {
    if (!error.message.toLowerCase().includes("cohort_lesson_homework")) {
      console.error("loadStudentCohortHomeworkCompletedMap:", error.message);
    }
    return map;
  }

  for (const row of data ?? []) {
    map.set(row.lesson_id as string, Boolean(row.completed));
  }

  return map;
}
