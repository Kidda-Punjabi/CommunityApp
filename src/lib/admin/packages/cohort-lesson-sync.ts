import "server-only";

import {
  assignmentForLessonNumber,
  cohortClassSessionTitle,
  initialLessonSyncMappings,
  needsLessonAssignmentWrite,
  type LessonRef,
  type LessonSyncLesson,
} from "@/lib/calendar/lesson-assignment";
import { formatSessionWhenUk } from "@/lib/calendar/uk-display-time";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CohortLessonSyncRow = {
  sessionId: string;
  startsAt: string;
  whenLabel: string;
  lessonId: string | null;
};

export type CohortLessonSyncPreview = {
  lessons: LessonSyncLesson[];
  rows: CohortLessonSyncRow[];
};

export async function loadCohortIndividualLessonSync(
  supabase: SupabaseClient,
  cohortId: string
): Promise<{ ok: true; preview: CohortLessonSyncPreview } | { ok: false; error: string }> {
  const { data: cohort, error: cohortError } = await supabase
    .from("cohorts")
    .select("id, name, course_id")
    .eq("id", cohortId)
    .maybeSingle();

  if (cohortError) return { ok: false, error: cohortError.message };
  if (!cohort) return { ok: false, error: "Cohort not found." };

  const title = cohortClassSessionTitle(cohort.name as string);
  const [{ data: lessonRows, error: lessonError }, { data: sessionRows, error: sessionError }] =
    await Promise.all([
      supabase
        .from("lessons")
        .select("id, lesson_number, title")
        .eq("course_id", cohort.course_id)
        .order("lesson_number", { ascending: true }),
      supabase
        .from("tutor_scheduled_sessions")
        .select("id, starts_at, lesson_id, lesson_assignment_status")
        .eq("cohort_id", cohortId)
        .eq("title", title)
        .neq("status", "cancelled")
        .order("starts_at", { ascending: true }),
    ]);

  if (lessonError) return { ok: false, error: lessonError.message };
  if (sessionError) return { ok: false, error: sessionError.message };

  const lessons: LessonSyncLesson[] = (lessonRows ?? []).map((lesson) => ({
    id: lesson.id as string,
    lessonNumber: lesson.lesson_number as number,
    title: lesson.title as string,
  }));
  const sessions = (sessionRows ?? []).map((session) => ({
    id: session.id as string,
    startsAt: session.starts_at as string,
    lessonId: (session.lesson_id as string | null) ?? null,
    needsAssignment: session.lesson_assignment_status === "needs_assignment",
  }));
  const mappings = initialLessonSyncMappings(lessons, sessions);
  const lessonIdBySession = new Map(mappings.map((mapping) => [mapping.sessionId, mapping.lessonId]));

  return {
    ok: true,
    preview: {
      lessons,
      rows: sessions.map((session) => ({
        sessionId: session.id,
        startsAt: session.startsAt,
        whenLabel: formatSessionWhenUk(session.startsAt),
        lessonId: lessonIdBySession.get(session.id) ?? null,
      })),
    },
  };
}

export async function confirmCohortIndividualLessonSync(
  supabase: SupabaseClient,
  input: {
    cohortId: string;
    mappings: Array<{ sessionId: string; lessonId: string | null }>;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: cohort, error: cohortError } = await supabase
    .from("cohorts")
    .select("id, name, course_id")
    .eq("id", input.cohortId)
    .maybeSingle();

  if (cohortError) return { ok: false, error: cohortError.message };
  if (!cohort) return { ok: false, error: "Cohort not found." };

  const title = cohortClassSessionTitle(cohort.name as string);
  const [{ data: lessonRows, error: lessonError }, { data: sessionRows, error: sessionError }] =
    await Promise.all([
      supabase
        .from("lessons")
        .select("id, lesson_number")
        .eq("course_id", cohort.course_id),
      supabase
        .from("tutor_scheduled_sessions")
        .select("id")
        .eq("cohort_id", input.cohortId)
        .eq("title", title)
        .neq("status", "cancelled"),
    ]);

  if (lessonError) return { ok: false, error: lessonError.message };
  if (sessionError) return { ok: false, error: sessionError.message };

  const lessons: LessonRef[] = (lessonRows ?? []).map((lesson) => ({
    id: lesson.id as string,
    lessonNumber: lesson.lesson_number as number,
  }));
  const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const sessionIds = new Set((sessionRows ?? []).map((session) => session.id as string));
  const mappedSessionIds = input.mappings.map((mapping) => mapping.sessionId);

  if (mappedSessionIds.length !== sessionIds.size || mappedSessionIds.some((id) => !sessionIds.has(id))) {
    return { ok: false, error: "The lesson list is out of date. Open sync again." };
  }

  const seenLessons = new Set<string>();
  for (const mapping of input.mappings) {
    if (!mapping.lessonId) continue;
    if (!lessonById.has(mapping.lessonId)) {
      return { ok: false, error: "One of the chosen lessons is not on this course." };
    }
    if (seenLessons.has(mapping.lessonId)) {
      return { ok: false, error: "Each lesson can only be assigned to one session." };
    }
    seenLessons.add(mapping.lessonId);
  }

  const now = new Date().toISOString();
  for (const mapping of input.mappings) {
    const lesson = mapping.lessonId ? lessonById.get(mapping.lessonId) : undefined;
    const assignment = lesson
      ? assignmentForLessonNumber(lesson.lessonNumber, [lesson])
      : needsLessonAssignmentWrite();

    const { error } = await supabase
      .from("tutor_scheduled_sessions")
      .update({
        ...assignment,
        match_method: "calendar_link",
        updated_at: now,
      })
      .eq("id", mapping.sessionId)
      .eq("cohort_id", input.cohortId);

    if (error) return { ok: false, error: error.message };
  }

  return { ok: true };
}
