import "server-only";

import {
  computeNextLessonAfterLog,
  numberLessonLogEntries,
  type CohortLessonProgress,
  type LessonLogEntrySummary,
} from "@/lib/lessons/lesson-log-progress";
import type { SupabaseClient } from "@supabase/supabase-js";

function isMissingLessonLogSchema(message: string): boolean {
  return message.toLowerCase().includes("cohort_lesson_log_entries");
}

export async function loadCourseLessonTotals(
  supabase: SupabaseClient
): Promise<Map<string, number>> {
  const { data, error } = await supabase.from("lessons").select("course_id");
  if (error) {
    if (isMissingLessonLogSchema(error.message)) return new Map();
    throw error;
  }
  const totals = new Map<string, number>();
  for (const row of data ?? []) {
    const courseId = row.course_id as string;
    totals.set(courseId, (totals.get(courseId) ?? 0) + 1);
  }
  return totals;
}

export async function loadLessonLogEntriesForCohorts(
  supabase: SupabaseClient,
  cohortIds: string[]
): Promise<Map<string, LessonLogEntrySummary[]>> {
  const byCohort = new Map<string, LessonLogEntrySummary[]>();
  if (cohortIds.length === 0) return byCohort;

  const { data, error } = await supabase
    .from("cohort_lesson_log_entries")
    .select("id, cohort_id, lesson_date, lesson_title, recording_url, notes")
    .in("cohort_id", cohortIds)
    .order("lesson_date", { ascending: true });

  if (error) {
    if (isMissingLessonLogSchema(error.message)) return byCohort;
    throw error;
  }

  const rawByCohort = new Map<
    string,
    Array<{
      id: string;
      lessonDate: string;
      lessonTitle: string | null;
      recordingUrl: string | null;
      notes: string | null;
    }>
  >();

  for (const row of data ?? []) {
    if (!row.cohort_id) continue;
    const list = rawByCohort.get(row.cohort_id) ?? [];
    list.push({
      id: row.id,
      lessonDate: row.lesson_date,
      lessonTitle: row.lesson_title,
      recordingUrl: row.recording_url,
      notes: row.notes,
    });
    rawByCohort.set(row.cohort_id, list);
  }

  for (const [cohortId, entries] of rawByCohort) {
    byCohort.set(
      cohortId,
      numberLessonLogEntries(entries).map((entry) => ({
        id: entry.id,
        lessonDate: entry.lessonDate,
        lessonTitle: entry.lessonTitle,
        recordingUrl: entry.recordingUrl,
        notes: entry.notes,
        weekNumber: entry.weekNumber,
      }))
    );
  }

  return byCohort;
}

export async function buildCohortLessonProgress(options: {
  courseId: string;
  weeklySessionStart: string | null;
  startDayOfWeek: string | null;
  entries: LessonLogEntrySummary[];
  totalLessons: number;
}): Promise<CohortLessonProgress> {
  const entries = [...options.entries].sort((a, b) => a.weekNumber - b.weekNumber);
  const completedCount = entries.length;
  const lastLessonDate = entries.length > 0 ? entries[entries.length - 1]!.lessonDate : null;
  const next =
    completedCount >= options.totalLessons && options.totalLessons > 0
      ? null
      : computeNextLessonAfterLog({
          weeklySessionStart: options.weeklySessionStart,
          startDayOfWeek: options.startDayOfWeek,
          lastLessonDate,
        });

  return {
    completedCount,
    totalLessons: options.totalLessons,
    remainingCount: Math.max(0, options.totalLessons - completedCount),
    lastLessonDate,
    nextLessonAt: next?.toISOString() ?? null,
    entries,
  };
}

export async function loadCohortLessonProgressMap(
  supabase: SupabaseClient,
  cohorts: Array<{
    id: string;
    courseId: string;
    weeklySessionStart: string | null;
    startDayOfWeek: string | null;
  }>
): Promise<Map<string, CohortLessonProgress>> {
  const result = new Map<string, CohortLessonProgress>();
  if (cohorts.length === 0) return result;

  const [totals, entriesByCohort] = await Promise.all([
    loadCourseLessonTotals(supabase),
    loadLessonLogEntriesForCohorts(
      supabase,
      cohorts.map((c) => c.id)
    ),
  ]);

  for (const cohort of cohorts) {
    const progress = await buildCohortLessonProgress({
      courseId: cohort.courseId,
      weeklySessionStart: cohort.weeklySessionStart,
      startDayOfWeek: cohort.startDayOfWeek,
      entries: entriesByCohort.get(cohort.id) ?? [],
      totalLessons: totals.get(cohort.courseId) ?? 0,
    });
    result.set(cohort.id, progress);
  }

  return result;
}
