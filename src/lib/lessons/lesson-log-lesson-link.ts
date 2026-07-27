import "server-only";

import { isCountableLessonLogStatus } from "@/lib/lessons/lesson-log-progress";
import type { SupabaseClient } from "@supabase/supabase-js";

export type LinkedCurriculumLesson = {
  lessonId: string;
  lessonNumber: number;
  title: string;
  pdfUrl: string | null;
};

export type LessonLogContentRefs = {
  pdfUrl: string | null;
  flashcardSetId: string | null;
  flashcardSetName: string | null;
};

const TIER_TO_FLASHCARD_ASSOCIATION: Record<string, string> = {
  foundational: "foundations",
  beginners: "beginners",
  community: "community",
};

function isMissingLessonIdColumn(message: string): boolean {
  return message.toLowerCase().includes("lesson_id");
}

/**
 * Map log entry position among non-cancelled cohort entries → curriculum lesson.
 */
export async function resolveCurriculumLessonForCohortLogEntry(
  supabase: SupabaseClient,
  cohortId: string,
  entryId: string
): Promise<LinkedCurriculumLesson | null> {
  const { data: cohort, error: cohortError } = await supabase
    .from("cohorts")
    .select("course_id")
    .eq("id", cohortId)
    .maybeSingle();

  if (cohortError) throw cohortError;
  if (!cohort?.course_id) return null;

  const { data: logRows, error: logError } = await supabase
    .from("cohort_lesson_log_entries")
    .select("id, lesson_date, status")
    .eq("cohort_id", cohortId)
    .order("lesson_date", { ascending: true })
    .order("id", { ascending: true });

  if (logError) throw logError;

  const countable = (logRows ?? []).filter((row) =>
    isCountableLessonLogStatus(row.status as string | null)
  );
  const index = countable.findIndex((row) => row.id === entryId);
  if (index < 0) return null;

  const lessonNumber = index + 1;
  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("id, lesson_number, title, pdf_url")
    .eq("course_id", cohort.course_id)
    .eq("lesson_number", lessonNumber)
    .maybeSingle();

  if (lessonError) throw lessonError;
  if (lesson) {
    return {
      lessonId: lesson.id,
      lessonNumber: lesson.lesson_number,
      title: lesson.title,
      pdfUrl: lesson.pdf_url,
    };
  }

  const { data: ordered } = await supabase
    .from("lessons")
    .select("id, lesson_number, title, pdf_url")
    .eq("course_id", cohort.course_id)
    .order("lesson_number", { ascending: true });

  const fallback = ordered?.[index];
  if (!fallback) return null;
  return {
    lessonId: fallback.id,
    lessonNumber: fallback.lesson_number,
    title: fallback.title,
    pdfUrl: fallback.pdf_url,
  };
}

/** Persist lesson_id for all entries in a cohort from sequential position rules. */
export async function syncCohortLessonLogLessonIds(
  supabase: SupabaseClient,
  cohortId: string
): Promise<void> {
  const { data: cohort, error: cohortError } = await supabase
    .from("cohorts")
    .select("course_id")
    .eq("id", cohortId)
    .maybeSingle();

  if (cohortError) {
    if (isMissingLessonIdColumn(cohortError.message)) return;
    throw cohortError;
  }
  if (!cohort?.course_id) return;

  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("id, lesson_number")
    .eq("course_id", cohort.course_id)
    .order("lesson_number", { ascending: true });

  if (lessonsError) throw lessonsError;

  const lessonIdByNumber = new Map<number, string>();
  const lessonIdByIndex: string[] = [];
  for (const lesson of lessons ?? []) {
    lessonIdByNumber.set(lesson.lesson_number, lesson.id);
    lessonIdByIndex.push(lesson.id);
  }

  const { data: logRows, error: logError } = await supabase
    .from("cohort_lesson_log_entries")
    .select("id, lesson_date, status, lesson_id")
    .eq("cohort_id", cohortId)
    .order("lesson_date", { ascending: true })
    .order("id", { ascending: true });

  if (logError) {
    if (isMissingLessonIdColumn(logError.message)) return;
    throw logError;
  }

  const countable = (logRows ?? []).filter((row) =>
    isCountableLessonLogStatus(row.status as string | null)
  );

  for (let index = 0; index < countable.length; index += 1) {
    const row = countable[index]!;
    const lessonNumber = index + 1;
    const targetLessonId =
      lessonIdByNumber.get(lessonNumber) ?? lessonIdByIndex[index] ?? null;
    if (!targetLessonId || row.lesson_id === targetLessonId) continue;
    const { error } = await supabase
      .from("cohort_lesson_log_entries")
      .update({ lesson_id: targetLessonId })
      .eq("id", row.id);
    if (error && !isMissingLessonIdColumn(error.message)) {
      console.error(`syncCohortLessonLogLessonIds update ${row.id}:`, error.message);
    }
  }

  // Cancelled / non-countable rows should not keep a curriculum link.
  for (const row of logRows ?? []) {
    if (isCountableLessonLogStatus(row.status as string | null)) continue;
    if (!row.lesson_id) continue;
    const { error } = await supabase
      .from("cohort_lesson_log_entries")
      .update({ lesson_id: null })
      .eq("id", row.id);
    if (error && !isMissingLessonIdColumn(error.message)) {
      console.error(`syncCohortLessonLogLessonIds clear ${row.id}:`, error.message);
    }
  }
}

export async function syncAllCohortLessonLogLessonIds(
  supabase: SupabaseClient
): Promise<void> {
  const { data: cohorts, error } = await supabase.from("cohorts").select("id");
  if (error) {
    if (isMissingLessonIdColumn(error.message)) return;
    throw error;
  }
  for (const cohort of cohorts ?? []) {
    await syncCohortLessonLogLessonIds(supabase, cohort.id);
  }
}

export async function loadLessonContentRefs(
  supabase: SupabaseClient,
  courseId: string,
  lessonNumber: number
): Promise<LessonLogContentRefs> {
  const { data: course } = await supabase
    .from("courses")
    .select("required_tier")
    .eq("id", courseId)
    .maybeSingle();

  const association =
    TIER_TO_FLASHCARD_ASSOCIATION[course?.required_tier ?? ""] ?? null;

  let flashcardSetId: string | null = null;
  let flashcardSetName: string | null = null;

  if (association) {
    const { data: sets } = await supabase
      .from("flashcard_sets")
      .select("id, name")
      .eq("course_association", association)
      .eq("week_number", lessonNumber)
      .limit(1);

    const set = sets?.[0];
    if (set) {
      flashcardSetId = set.id;
      flashcardSetName = set.name;
    }
  }

  const { data: lesson } = await supabase
    .from("lessons")
    .select("pdf_url")
    .eq("course_id", courseId)
    .eq("lesson_number", lessonNumber)
    .maybeSingle();

  return {
    pdfUrl: lesson?.pdf_url ?? null,
    flashcardSetId,
    flashcardSetName,
  };
}

export function formatCurriculumLessonLabel(
  lessonNumber: number,
  title: string
): string {
  return `Lesson ${lessonNumber} — ${title}`;
}
