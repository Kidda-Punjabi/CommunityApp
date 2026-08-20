import "server-only";

import { RESCHEDULE_CUTOFF_MS } from "@/lib/calendar/constants";
import { attachLessonLabelsToSessions } from "@/lib/calendar/session-lesson-labels";
import type { ScheduledSessionRow } from "@/lib/calendar/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/** True when the request was made with fewer than 24h until the lesson. */
export function isLateRescheduleRequest(
  sessionStartsAt: string,
  requestCreatedAt: string
): boolean {
  const startsMs = new Date(sessionStartsAt).getTime();
  const createdMs = new Date(requestCreatedAt).getTime();
  if (Number.isNaN(startsMs) || Number.isNaN(createdMs)) return false;
  return startsMs - createdMs < RESCHEDULE_CUTOFF_MS;
}

/**
 * Lesson IDs where a 1-to-1 student should see Session catch-up instead of Recording:
 * denied late reschedule on the mapped session, and catch-up segments exist.
 */
export async function fetchSessionCatchupLessonIdsForUser(
  supabase: SupabaseClient,
  studentId: string,
  lessons: Array<{ id: string; lesson_number: number; course_id: string }>
): Promise<Set<string>> {
  if (lessons.length === 0) return new Set();

  const courseIds = [...new Set(lessons.map((lesson) => lesson.course_id))];
  const { data: enrollments, error: enrollmentError } = await supabase
    .from("course_enrollments")
    .select("course_id, tutor_id, delivery_mode")
    .eq("user_id", studentId)
    .in("course_id", courseIds)
    .eq("delivery_mode", "one_to_one");

  if (enrollmentError) throw enrollmentError;
  if (!enrollments?.length) return new Set();

  const oneToOneCourseIds = new Set(enrollments.map((row) => row.course_id as string));
  const tutorIds = [
    ...new Set(enrollments.map((row) => row.tutor_id).filter(Boolean) as string[]),
  ];
  if (tutorIds.length === 0) return new Set();

  const lessonIds = lessons
    .filter((lesson) => oneToOneCourseIds.has(lesson.course_id))
    .map((lesson) => lesson.id);
  if (lessonIds.length === 0) return new Set();

  const [{ data: sessions, error: sessionsError }, { data: segmentRows, error: segmentError }] =
    await Promise.all([
      supabase
        .from("tutor_scheduled_sessions")
        .select("*")
        .eq("student_id", studentId)
        .in("tutor_id", tutorIds)
        .in("course_id", [...oneToOneCourseIds])
        .is("cohort_id", null)
        .neq("match_method", "unmatched")
        .neq("match_method", "title_name")
        .order("starts_at", { ascending: true }),
      supabase.from("lesson_segments").select("lesson_id").in("lesson_id", lessonIds),
    ]);

  if (sessionsError) throw sessionsError;
  if (segmentError) throw segmentError;

  const lessonsWithSegments = new Set((segmentRows ?? []).map((row) => row.lesson_id as string));
  if (lessonsWithSegments.size === 0) return new Set();

  const sessionRows = (sessions ?? []) as ScheduledSessionRow[];
  if (sessionRows.length === 0) return new Set();

  const sessionIds = sessionRows.map((session) => session.id);
  const { data: deniedRequests, error: requestError } = await supabase
    .from("lesson_reschedule_requests")
    .select("session_id, created_at, status")
    .eq("student_id", studentId)
    .eq("status", "denied")
    .in("session_id", sessionIds);

  if (requestError) throw requestError;
  if (!deniedRequests?.length) return new Set();

  const lateDeniedSessionIds = new Set<string>();
  const sessionById = new Map(sessionRows.map((session) => [session.id, session]));
  for (const request of deniedRequests) {
    const session = sessionById.get(request.session_id);
    if (!session) continue;
    if (isLateRescheduleRequest(session.starts_at, request.created_at)) {
      lateDeniedSessionIds.add(request.session_id);
    }
  }

  if (lateDeniedSessionIds.size === 0) return new Set();

  const labelled = await attachLessonLabelsToSessions(supabase, sessionRows);
  const lessonIdByNumberAndCourse = new Map(
    lessons.map((lesson) => [`${lesson.course_id}:${lesson.lesson_number}`, lesson.id] as const)
  );

  const eligible = new Set<string>();
  for (const session of labelled) {
    if (!lateDeniedSessionIds.has(session.id)) continue;
    if (!session.course_id || session.lessonNumber == null) continue;
    const lessonId = lessonIdByNumberAndCourse.get(
      `${session.course_id}:${session.lessonNumber}`
    );
    if (!lessonId || !lessonsWithSegments.has(lessonId)) continue;
    eligible.add(lessonId);
  }

  return eligible;
}

export async function unlockLessonForStudentAfterLateDeniedReschedule(
  supabase: SupabaseClient,
  params: {
    studentId: string;
    sessionId: string;
    unlockedBy: string;
  }
): Promise<{ unlockedLessonId: string | null; error?: string }> {
  const { data: session, error: sessionError } = await supabase
    .from("tutor_scheduled_sessions")
    .select("*")
    .eq("id", params.sessionId)
    .maybeSingle();

  if (sessionError) return { unlockedLessonId: null, error: sessionError.message };
  if (!session || session.cohort_id || !session.course_id) {
    return { unlockedLessonId: null };
  }

  const { data: request } = await supabase
    .from("lesson_reschedule_requests")
    .select("created_at, status")
    .eq("session_id", params.sessionId)
    .eq("student_id", params.studentId)
    .maybeSingle();

  if (!request) return { unlockedLessonId: null };

  // Only late attempts (requested within the reschedule cutoff of start) unlock Session catch-up.
  if (!isLateRescheduleRequest(session.starts_at, request.created_at)) {
    return { unlockedLessonId: null };
  }

  const labelled = await attachLessonLabelsToSessions(supabase, [
    session as ScheduledSessionRow,
  ]);
  const lessonNumber = labelled[0]?.lessonNumber;
  if (!lessonNumber) return { unlockedLessonId: null };

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("id")
    .eq("course_id", session.course_id)
    .eq("lesson_number", lessonNumber)
    .maybeSingle();

  if (lessonError) return { unlockedLessonId: null, error: lessonError.message };
  if (!lesson?.id) return { unlockedLessonId: null };

  const { error: unlockError } = await supabase.from("student_lesson_unlocks").upsert(
    {
      student_id: params.studentId,
      lesson_id: lesson.id,
      unlocked_by: params.unlockedBy,
      unlocked_at: new Date().toISOString(),
    },
    { onConflict: "student_id,lesson_id" }
  );

  if (unlockError) return { unlockedLessonId: null, error: unlockError.message };
  return { unlockedLessonId: lesson.id };
}
