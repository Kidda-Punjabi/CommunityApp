import "server-only";

import {
  assignmentForLessonNumber,
  initialLessonSyncMappings,
  needsLessonAssignmentWrite,
  type LessonRef,
  type LessonSyncLesson,
} from "@/lib/calendar/lesson-assignment";
import {
  cohortWeekNumberWriteError,
  isGuardedCohortClassSession,
  isOneToOneSessionTitle,
} from "@/lib/calendar/cohort-week-number-guard";
import {
  cohortAnchorTitlesByCohort,
  isCohortClassSession,
  type CohortClassSessionMatchInput,
} from "@/lib/calendar/cohort-session-week-number";
import { formatSessionWhenUk } from "@/lib/calendar/uk-display-time";
import type { SupabaseClient } from "@supabase/supabase-js";

function qualifyingSessionIds(
  cohortId: string,
  rows: Array<CohortClassSessionMatchInput & { id: string }>
): Set<string> {
  const anchorTitles = cohortAnchorTitlesByCohort(rows).get(cohortId);
  return new Set(
    rows.filter((row) => isCohortClassSession(row, anchorTitles)).map((row) => row.id)
  );
}

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
    .select("id, course_id")
    .eq("id", cohortId)
    .maybeSingle();

  if (cohortError) return { ok: false, error: cohortError.message };
  if (!cohort) return { ok: false, error: "Cohort not found." };

  const [{ data: lessonRows, error: lessonError }, { data: sessionRows, error: sessionError }] =
    await Promise.all([
      supabase
        .from("lessons")
        .select("id, lesson_number, title")
        .eq("course_id", cohort.course_id)
        .order("lesson_number", { ascending: true }),
      supabase
        .from("tutor_scheduled_sessions")
        .select("id, cohort_id, title, status, match_method, starts_at, lesson_id, lesson_assignment_status")
        .eq("cohort_id", cohortId)
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
  const qualifyingIds = qualifyingSessionIds(
    cohortId,
    (sessionRows ?? []).map((session) => ({
      id: session.id as string,
      cohort_id: cohortId,
      title: session.title as string,
      status: session.status as string | null,
      match_method: session.match_method as string | null,
    }))
  );
  const sessions = (sessionRows ?? []).filter((session) => qualifyingIds.has(session.id as string)).map((session) => ({
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
    .select("id, course_id")
    .eq("id", input.cohortId)
    .maybeSingle();

  if (cohortError) return { ok: false, error: cohortError.message };
  if (!cohort) return { ok: false, error: "Cohort not found." };

  const [{ data: lessonRows, error: lessonError }, { data: sessionRows, error: sessionError }] =
    await Promise.all([
      supabase
        .from("lessons")
        .select("id, lesson_number")
        .eq("course_id", cohort.course_id),
      supabase
        .from("tutor_scheduled_sessions")
        .select("id, cohort_id, title, status, match_method, starts_at, week_number")
        .eq("cohort_id", input.cohortId)
        .neq("status", "cancelled"),
    ]);

  if (lessonError) return { ok: false, error: lessonError.message };
  if (sessionError) return { ok: false, error: sessionError.message };

  const lessons: LessonRef[] = (lessonRows ?? []).map((lesson) => ({
    id: lesson.id as string,
    lessonNumber: lesson.lesson_number as number,
  }));
  const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const sessionIds = qualifyingSessionIds(
    input.cohortId,
    (sessionRows ?? []).map((session) => ({
      id: session.id as string,
      cohort_id: input.cohortId,
      title: session.title as string,
      status: session.status as string | null,
      match_method: session.match_method as string | null,
    }))
  );
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

  const loadedSessions = (sessionRows ?? []).map((session) => ({
    id: session.id as string,
    cohort_id: input.cohortId,
    title: session.title as string,
    status: session.status as string | null,
    match_method: session.match_method as string | null,
    starts_at: session.starts_at as string,
    week_number: (session.week_number as number | null) ?? null,
  }));
  const anchorTitles = cohortAnchorTitlesByCohort(loadedSessions).get(input.cohortId);
  const proposedWeeks = loadedSessions
    .filter((session) => isGuardedCohortClassSession(session, anchorTitles))
    .map((session) => {
      const mapping = input.mappings.find((row) => row.sessionId === session.id);
      if (!mapping) {
        return { id: session.id, startsAt: session.starts_at, weekNumber: session.week_number };
      }
      const lesson = mapping.lessonId ? lessonById.get(mapping.lessonId) : undefined;
      return {
        id: session.id,
        startsAt: session.starts_at,
        weekNumber: lesson ? lesson.lessonNumber : null,
      };
    });
  const weekError = cohortWeekNumberWriteError(proposedWeeks);
  if (weekError) return { ok: false, error: weekError };

  const now = new Date().toISOString();
  for (const mapping of input.mappings) {
    const lesson = mapping.lessonId ? lessonById.get(mapping.lessonId) : undefined;
    const assignment = lesson
      ? assignmentForLessonNumber(lesson.lessonNumber, [lesson])
      : needsLessonAssignmentWrite();
    const loaded = loadedSessions.find((session) => session.id === mapping.sessionId);
    const leaveWeekNumber = loaded ? isOneToOneSessionTitle(loaded.title) : false;
    const update: {
      lesson_id: string | null;
      lesson_assignment_status: typeof assignment.lesson_assignment_status;
      week_number?: number | null;
      match_method: "calendar_link";
      updated_at: string;
    } = {
      lesson_id: assignment.lesson_id,
      lesson_assignment_status: assignment.lesson_assignment_status,
      match_method: "calendar_link",
      updated_at: now,
    };
    if (!leaveWeekNumber) update.week_number = assignment.week_number;

    const { error } = await supabase
      .from("tutor_scheduled_sessions")
      .update(update)
      .eq("id", mapping.sessionId)
      .eq("cohort_id", input.cohortId);

    if (error) return { ok: false, error: error.message };
  }

  return { ok: true };
}
