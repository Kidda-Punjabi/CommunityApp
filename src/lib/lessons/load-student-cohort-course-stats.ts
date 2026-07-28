import "server-only";

import { isCountableLessonLogStatus } from "@/lib/lessons/lesson-log-progress";
import type { SupabaseClient } from "@supabase/supabase-js";

export type StudentCohortCourseStats = {
  cohortId: string;
  availableLessons: number;
  attendedCount: number;
  homeworkCompletedCount: number;
  attendancePercent: number;
  homeworkPercent: number;
};

function percentOf(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

/**
 * Attendance + homework rates against lessons that have actually happened
 * (past, non-cancelled cohort log entries with a linked curriculum lesson).
 */
export async function loadStudentCohortCourseStats(
  supabase: SupabaseClient,
  userId: string,
  courseIds: string[]
): Promise<StudentCohortCourseStats | null> {
  if (courseIds.length === 0) return null;

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("course_enrollments")
    .select("cohort_id, delivery_mode, course_id")
    .eq("user_id", userId)
    .in("course_id", courseIds)
    .eq("delivery_mode", "group")
    .not("cohort_id", "is", null)
    .maybeSingle();

  if (enrollmentError) {
    console.error("loadStudentCohortCourseStats enrollment:", enrollmentError.message);
    return null;
  }

  const cohortId = enrollment?.cohort_id as string | null;
  if (!cohortId) return null;

  const today = new Date().toISOString().slice(0, 10);
  const { data: logRows, error: logError } = await supabase
    .from("cohort_lesson_log_entries")
    .select("lesson_id, lesson_date, status")
    .eq("cohort_id", cohortId)
    .not("lesson_id", "is", null)
    .lte("lesson_date", today);

  if (logError) {
    console.error("loadStudentCohortCourseStats logs:", logError.message);
    return null;
  }

  const availableLessonIds = [
    ...new Set(
      (logRows ?? [])
        .filter((row) => isCountableLessonLogStatus(row.status as string | null))
        .map((row) => row.lesson_id as string)
        .filter(Boolean)
    ),
  ];

  if (availableLessonIds.length === 0) return null;

  const [{ data: attendanceRows, error: attendanceError }, { data: homeworkRows, error: homeworkError }] =
    await Promise.all([
      supabase
        .from("cohort_lesson_attendance")
        .select("lesson_id, attended")
        .eq("cohort_id", cohortId)
        .eq("student_id", userId)
        .in("lesson_id", availableLessonIds)
        .eq("attended", true),
      supabase
        .from("cohort_lesson_homework")
        .select("lesson_id, completed")
        .eq("cohort_id", cohortId)
        .eq("student_id", userId)
        .in("lesson_id", availableLessonIds)
        .eq("completed", true),
    ]);

  if (attendanceError) {
    console.error("loadStudentCohortCourseStats attendance:", attendanceError.message);
  }
  if (homeworkError) {
    // Table may be missing in older environments — treat as zero completed.
    if (!homeworkError.message.toLowerCase().includes("cohort_lesson_homework")) {
      console.error("loadStudentCohortCourseStats homework:", homeworkError.message);
    }
  }

  const attendedCount = new Set((attendanceRows ?? []).map((row) => row.lesson_id as string)).size;
  const homeworkCompletedCount = new Set(
    (homeworkRows ?? []).map((row) => row.lesson_id as string)
  ).size;
  const availableLessons = availableLessonIds.length;

  return {
    cohortId,
    availableLessons,
    attendedCount,
    homeworkCompletedCount,
    attendancePercent: percentOf(attendedCount, availableLessons),
    homeworkPercent: percentOf(homeworkCompletedCount, availableLessons),
  };
}
