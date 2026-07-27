import "server-only";

import {
  computeNextLessonAfterLog,
  isCountableLessonLogStatus,
  numberLessonLogEntries,
  resolveNextLessonTitle,
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

/** Lessons ordered by lesson_number for next-topic derivation. */
export async function loadCourseLessonsOrdered(
  supabase: SupabaseClient,
  courseIds: string[]
): Promise<Map<string, Array<{ lessonNumber: number; title: string }>>> {
  const byCourse = new Map<string, Array<{ lessonNumber: number; title: string }>>();
  if (courseIds.length === 0) return byCourse;

  const { data, error } = await supabase
    .from("lessons")
    .select("course_id, lesson_number, title")
    .in("course_id", courseIds)
    .order("lesson_number", { ascending: true });

  if (error) {
    if (isMissingLessonLogSchema(error.message)) return byCourse;
    throw error;
  }

  for (const row of data ?? []) {
    const courseId = row.course_id as string;
    const list = byCourse.get(courseId) ?? [];
    list.push({
      lessonNumber: Number(row.lesson_number) || list.length + 1,
      title: String(row.title ?? "Untitled lesson"),
    });
    byCourse.set(courseId, list);
  }
  return byCourse;
}

export async function loadLessonLogEntriesForCohorts(
  supabase: SupabaseClient,
  cohortIds: string[]
): Promise<Map<string, LessonLogEntrySummary[]>> {
  const byCohort = new Map<string, LessonLogEntrySummary[]>();
  if (cohortIds.length === 0) return byCohort;

  const { data, error } = await supabase
    .from("cohort_lesson_log_entries")
    .select("id, cohort_id, lesson_date, lesson_title, recording_url, notes, status")
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
      status: string | null;
    }>
  >();

  for (const row of data ?? []) {
    if (!row.cohort_id) continue;
    if (!isCountableLessonLogStatus(row.status as string | null)) continue;
    const list = rawByCohort.get(row.cohort_id) ?? [];
    list.push({
      id: row.id,
      lessonDate: row.lesson_date,
      lessonTitle: row.lesson_title,
      recordingUrl: row.recording_url,
      notes: row.notes,
      status: (row.status as string | null) ?? null,
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
        status: entry.status,
      }))
    );
  }

  return byCohort;
}

export async function buildCohortLessonProgress(options: {
  courseId: string;
  weeklySessionStart: string | null;
  startDayOfWeek: string | null;
  startDate?: string | null;
  entries: LessonLogEntrySummary[];
  totalLessons: number;
  courseLessonsOrdered?: Array<{ lessonNumber: number; title: string }>;
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
          startDate: options.startDate ?? null,
          lastLessonDate,
        });

  return {
    completedCount,
    totalLessons: options.totalLessons,
    remainingCount: Math.max(0, options.totalLessons - completedCount),
    lastLessonDate,
    nextLessonAt: next?.toISOString() ?? null,
    nextLessonTitle: resolveNextLessonTitle(
      options.courseLessonsOrdered ?? [],
      completedCount
    ),
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
    startDate?: string | null;
  }>
): Promise<Map<string, CohortLessonProgress>> {
  const result = new Map<string, CohortLessonProgress>();
  if (cohorts.length === 0) return result;

  const courseIds = [...new Set(cohorts.map((c) => c.courseId))];
  const [totals, entriesByCohort, lessonsByCourse] = await Promise.all([
    loadCourseLessonTotals(supabase),
    loadLessonLogEntriesForCohorts(
      supabase,
      cohorts.map((c) => c.id)
    ),
    loadCourseLessonsOrdered(supabase, courseIds),
  ]);

  for (const cohort of cohorts) {
    const progress = await buildCohortLessonProgress({
      courseId: cohort.courseId,
      weeklySessionStart: cohort.weeklySessionStart,
      startDayOfWeek: cohort.startDayOfWeek,
      startDate: cohort.startDate ?? null,
      entries: entriesByCohort.get(cohort.id) ?? [],
      totalLessons: totals.get(cohort.courseId) ?? 0,
      courseLessonsOrdered: lessonsByCourse.get(cohort.courseId) ?? [],
    });
    result.set(cohort.id, progress);
  }

  return result;
}
