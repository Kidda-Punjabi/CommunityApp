import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const NEAR_LESSON_WINDOW_MS = 24 * 60 * 60 * 1000;

export type HomeworkTimingState = "on_time" | "late" | "post_lesson" | "unknown";

/**
 * Resolve the live session start time that corresponds to this homework lesson.
 *
 * tutor_scheduled_sessions has no lesson_id — join path:
 * lesson → course_id + lesson_number → course_enrollments (cohort / 1:1) →
 * chronological matched sessions for that cohort/student (Nth session ≈ lesson N).
 */
export async function findHomeworkLessonSessionStartsAt(
  supabase: SupabaseClient,
  studentId: string,
  lessonId: string
): Promise<string | null> {
  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("id, course_id, lesson_number")
    .eq("id", lessonId)
    .maybeSingle();

  if (lessonError || !lesson?.course_id) return null;

  const courseId = lesson.course_id as string;
  const lessonNumber = Number(lesson.lesson_number);
  if (!Number.isFinite(lessonNumber) || lessonNumber < 1) return null;

  const { data: enrollment } = await supabase
    .from("course_enrollments")
    .select("cohort_id, delivery_mode")
    .eq("user_id", studentId)
    .eq("course_id", courseId)
    .maybeSingle();

  const cohortId = (enrollment?.cohort_id as string | null) ?? null;

  let query = supabase
    .from("tutor_scheduled_sessions")
    .select("id, starts_at, student_id, cohort_id, course_id")
    .eq("status", "scheduled")
    .neq("match_method", "unmatched")
    .neq("match_method", "title_name")
    .order("starts_at", { ascending: true })
    .limit(100);

  if (cohortId) {
    query = query.eq("cohort_id", cohortId);
  } else {
    query = query.eq("student_id", studentId).eq("course_id", courseId);
  }

  const { data: sessions, error: sessionError } = await query;
  if (sessionError || !sessions?.length) return null;

  const matching = sessions.filter((row) => {
    if (cohortId) {
      return row.cohort_id === cohortId && (!row.course_id || row.course_id === courseId);
    }
    return row.student_id === studentId && row.course_id === courseId;
  });

  const indexed = matching[lessonNumber - 1];
  if (indexed?.starts_at) return indexed.starts_at as string;

  // Fallback: nearest session by absolute time distance (legacy ±24h behaviour).
  const now = Date.now();
  let best: { startsAt: string; distance: number } | null = null;
  for (const row of matching) {
    if (!row.starts_at) continue;
    const distance = Math.abs(new Date(row.starts_at as string).getTime() - now);
    if (!best || distance < best.distance) {
      best = { startsAt: row.starts_at as string, distance };
    }
  }
  return best?.startsAt ?? null;
}

/** @deprecated Prefer findHomeworkLessonSessionStartsAt + getHomeworkTimingState */
export async function findNearLessonSessionStartsAt(
  supabase: SupabaseClient,
  studentId: string,
  lessonId: string,
  now: Date = new Date()
): Promise<string | null> {
  const startsAt = await findHomeworkLessonSessionStartsAt(supabase, studentId, lessonId);
  if (!startsAt) return null;
  const distance = Math.abs(new Date(startsAt).getTime() - now.getTime());
  return distance <= NEAR_LESSON_WINDOW_MS ? startsAt : null;
}

export function homeworkTimingStateFromStartsAt(
  startsAt: string | null | undefined,
  now: Date = new Date()
): HomeworkTimingState {
  if (!startsAt) return "unknown";
  const startMs = new Date(startsAt).getTime();
  if (Number.isNaN(startMs)) return "unknown";
  const nowMs = now.getTime();
  if (startMs <= nowMs) return "post_lesson";
  if (startMs - nowMs < NEAR_LESSON_WINDOW_MS) return "late";
  return "on_time";
}

export async function getHomeworkTimingState(
  supabase: SupabaseClient,
  studentId: string,
  lessonId: string,
  now: Date = new Date()
): Promise<HomeworkTimingState> {
  const startsAt = await findHomeworkLessonSessionStartsAt(supabase, studentId, lessonId);
  return homeworkTimingStateFromStartsAt(startsAt, now);
}

/** True when the student should see a non-blocking late or post-lesson warning. */
export async function shouldWarnHomeworkNearLesson(
  supabase: SupabaseClient,
  studentId: string,
  lessonId: string
): Promise<boolean> {
  const state = await getHomeworkTimingState(supabase, studentId, lessonId);
  return state === "late" || state === "post_lesson";
}
