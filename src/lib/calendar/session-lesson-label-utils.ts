import type { ScheduledSessionRow } from "@/lib/calendar/types";

export type LessonNumberContext = {
  completedByCohort: Map<string, number>;
  oneToOneLessonNumberBySessionId: Map<string, number>;
  nowMs?: number;
};

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function formatUpcomingLessonLabel(
  lessonNumber: number | null,
  startsAtIso: string
): string {
  const shortDate = formatShortDate(startsAtIso);
  if (lessonNumber == null) return shortDate;
  return `Lesson ${lessonNumber} — ${shortDate}`;
}

/**
 * Map calendar sessions to curriculum lesson numbers.
 *
 * Cohort sessions join on stored `week_number` (= lessons.lesson_number).
 * The old completed-log + array-index formula is only a fallback when
 * week_number is missing, and only for upcoming-only lists — applying it
 * to a past+future list labelled week 1 as "Lesson N+1".
 */
export function lessonNumberForSession<T extends ScheduledSessionRow>(
  session: T,
  cohortSessionsSorted: T[],
  nextIndexByKey: Map<string, number>,
  context: LessonNumberContext
): number | null {
  if (session.cohort_id) {
    if (session.week_number != null) return session.week_number;

    const nowMs = context.nowMs ?? Date.now();
    const includesPast = cohortSessionsSorted.some(
      (row) => new Date(row.starts_at).getTime() < nowMs
    );
    if (includesPast) {
      const index = cohortSessionsSorted.findIndex((row) => row.id === session.id);
      return index >= 0 ? index + 1 : null;
    }

    const key = `cohort:${session.cohort_id}`;
    const base = context.completedByCohort.get(session.cohort_id) ?? 0;
    const offset = nextIndexByKey.get(key) ?? 0;
    nextIndexByKey.set(key, offset + 1);
    return base + offset + 1;
  }

  if (session.student_id) {
    return context.oneToOneLessonNumberBySessionId.get(session.id) ?? null;
  }

  return null;
}

export function assignLessonLabels<T extends ScheduledSessionRow>(
  sessions: T[],
  context: LessonNumberContext
): Map<string, { lessonNumber: number | null; lessonLabel: string }> {
  const nextIndexByKey = new Map<string, number>();
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );
  const sortedByCohort = new Map<string, T[]>();
  for (const session of sorted) {
    if (!session.cohort_id) continue;
    const list = sortedByCohort.get(session.cohort_id) ?? [];
    list.push(session);
    sortedByCohort.set(session.cohort_id, list);
  }

  const labelById = new Map<string, { lessonNumber: number | null; lessonLabel: string }>();
  for (const session of sorted) {
    const cohortSessions = session.cohort_id
      ? (sortedByCohort.get(session.cohort_id) ?? [])
      : [];
    const lessonNumber = lessonNumberForSession(
      session,
      cohortSessions,
      nextIndexByKey,
      context
    );
    labelById.set(session.id, {
      lessonNumber,
      lessonLabel: formatUpcomingLessonLabel(lessonNumber, session.starts_at),
    });
  }
  return labelById;
}
