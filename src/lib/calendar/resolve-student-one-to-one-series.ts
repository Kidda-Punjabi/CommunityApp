import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * For each course, find the admin-linked 1-to-1 recurring series (manual package
 * calendar link). Returns the series id with the most linked session rows.
 */
export async function resolvePrimaryOneToOneSeriesByCourse(
  supabase: SupabaseClient,
  studentId: string,
  courseIds: string[]
): Promise<Map<string, string>> {
  const seriesByCourseId = new Map<string, string>();
  if (courseIds.length === 0) return seriesByCourseId;

  const { data: rows, error } = await supabase
    .from("tutor_scheduled_sessions")
    .select("course_id, google_recurring_event_id")
    .eq("student_id", studentId)
    .in("course_id", courseIds)
    .eq("match_method", "manual")
    .is("cohort_id", null)
    .not("google_recurring_event_id", "is", null);

  if (error) throw error;

  const countByCourseAndSeries = new Map<string, number>();
  for (const row of rows ?? []) {
    const courseId = row.course_id as string | null;
    const seriesId = row.google_recurring_event_id as string | null;
    if (!courseId || !seriesId) continue;
    const key = `${courseId}:${seriesId}`;
    countByCourseAndSeries.set(key, (countByCourseAndSeries.get(key) ?? 0) + 1);
  }

  for (const courseId of courseIds) {
    let bestSeries: string | null = null;
    let bestCount = 0;
    for (const [key, count] of countByCourseAndSeries) {
      if (!key.startsWith(`${courseId}:`)) continue;
      const seriesId = key.slice(courseId.length + 1);
      if (count > bestCount) {
        bestCount = count;
        bestSeries = seriesId;
      }
    }
    if (bestSeries) {
      seriesByCourseId.set(courseId, bestSeries);
    }
  }

  return seriesByCourseId;
}
