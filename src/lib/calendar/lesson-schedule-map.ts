import type { StudentScheduledSession } from "@/lib/calendar/types";

type LessonRef = {
  id: string;
  lesson_number: number;
};

export type ScheduleMapSession = Pick<
  StudentScheduledSession,
  "course_id" | "starts_at"
> & {
  lessonNumber?: number | null;
};

/**
 * Map calendar sessions onto curriculum lessons by week equality:
 * session.lessonNumber (from tutor_scheduled_sessions.week_number) =
 * lessons.lesson_number, scoped to the same course.
 */
export function buildScheduleSessionByLessonId<T extends ScheduleMapSession>(
  sessions: T[],
  lessons: LessonRef[],
  courseIds: string[]
): Map<string, T> {
  const lessonIdByNumber = new Map(lessons.map((lesson) => [lesson.lesson_number, lesson.id]));
  const map = new Map<string, T>();

  for (const session of sessions) {
    if (!session.course_id || !courseIds.includes(session.course_id)) continue;
    if (session.lessonNumber == null) continue;
    const lessonId = lessonIdByNumber.get(session.lessonNumber);
    if (!lessonId || map.has(lessonId)) continue;
    map.set(lessonId, session);
  }

  return map;
}

/**
 * Kids group calendars often have week_number unset. Prefer stored week numbers,
 * then fill remaining weeks from chronological session order.
 * Adult Learn continues to use `buildScheduleSessionByLessonId` only.
 */
export function buildKidsScheduleSessionByLessonId<T extends ScheduleMapSession>(
  sessions: T[],
  lessons: LessonRef[],
  courseIds: string[]
): Map<string, T> {
  const map = buildScheduleSessionByLessonId(sessions, lessons, courseIds);
  const used = new Set(map.values());
  const inCourse = sessions.filter(
    (session) => !session.course_id || courseIds.includes(session.course_id)
  );
  const leftover = inCourse
    .filter((session) => !used.has(session))
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const unmapped = [...lessons]
    .sort((a, b) => a.lesson_number - b.lesson_number)
    .filter((lesson) => !map.has(lesson.id));

  for (let index = 0; index < unmapped.length && index < leftover.length; index += 1) {
    map.set(unmapped[index].id, leftover[index]);
  }

  return map;
}
