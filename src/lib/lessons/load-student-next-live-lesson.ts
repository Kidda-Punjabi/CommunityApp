import "server-only";

import { loadCohortLessonProgressMap } from "@/lib/lessons/load-lesson-log-progress";
import type { SupabaseClient } from "@supabase/supabase-js";

export type StudentNextLiveLesson = {
  cohortId: string;
  cohortName: string;
  nextLessonAt: string;
  completedCount: number;
  totalLessons: number;
};

/** Next live group lesson for the student's active cohort membership(s). */
export async function loadStudentNextLiveLesson(
  supabase: SupabaseClient,
  userId: string
): Promise<StudentNextLiveLesson | null> {
  const { data: memberships, error } = await supabase
    .from("cohort_members")
    .select("cohort_id, cohorts(id, name, course_id, weekly_session_start, start_day_of_week, status)")
    .eq("user_id", userId)
    .is("left_at", null);

  if (error || !memberships?.length) return null;

  const cohorts = memberships
    .map((row) => {
      const raw = row.cohorts as unknown;
      const cohort = (Array.isArray(raw) ? raw[0] : raw) as
        | {
            id: string;
            name: string;
            course_id: string;
            weekly_session_start: string | null;
            start_day_of_week: string | null;
            status: string | null;
          }
        | null
        | undefined;
      if (!cohort) return null;
      if (
        cohort.status &&
        ["postponed", "incomplete", "classes_completed", "offboarding_complete"].includes(
          cohort.status
        )
      ) {
        return null;
      }
      return {
        id: cohort.id,
        name: cohort.name,
        courseId: cohort.course_id,
        weeklySessionStart: cohort.weekly_session_start,
        startDayOfWeek: cohort.start_day_of_week,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (cohorts.length === 0) return null;

  const progressMap = await loadCohortLessonProgressMap(
    supabase,
    cohorts.map((c) => ({
      id: c.id,
      courseId: c.courseId,
      weeklySessionStart: c.weeklySessionStart,
      startDayOfWeek: c.startDayOfWeek,
    }))
  );

  let best: StudentNextLiveLesson | null = null;
  for (const cohort of cohorts) {
    const progress = progressMap.get(cohort.id);
    if (!progress?.nextLessonAt) continue;
    if (!best || progress.nextLessonAt < best.nextLessonAt) {
      best = {
        cohortId: cohort.id,
        cohortName: cohort.name,
        nextLessonAt: progress.nextLessonAt,
        completedCount: progress.completedCount,
        totalLessons: progress.totalLessons,
      };
    }
  }

  return best;
}
