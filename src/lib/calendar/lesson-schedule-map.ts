import type { StudentScheduledSession } from "@/lib/calendar/types";

type LessonRef = {
  id: string;
  lesson_number: number;
};

/**
 * Map calendar sessions onto curriculum lessons by week equality:
 * session.lessonNumber (from tutor_scheduled_sessions.week_number) =
 * lessons.lesson_number, scoped to the same course.
 */
export function buildScheduleSessionByLessonId(
  sessions: StudentScheduledSession[],
  lessons: LessonRef[],
  courseIds: string[]
): Map<string, StudentScheduledSession> {
  const lessonIdByNumber = new Map(lessons.map((lesson) => [lesson.lesson_number, lesson.id]));
  const map = new Map<string, StudentScheduledSession>();

  for (const session of sessions) {
    if (!session.course_id || !courseIds.includes(session.course_id)) continue;
    if (session.lessonNumber == null) continue;
    const lessonId = lessonIdByNumber.get(session.lessonNumber);
    if (!lessonId || map.has(lessonId)) continue;
    map.set(lessonId, session);
  }

  return map;
}
