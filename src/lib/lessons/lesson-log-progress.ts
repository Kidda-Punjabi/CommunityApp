/**
 * Progress helpers for cohort Lessons Log (weeks completed / next lesson).
 */

export type LessonLogEntrySummary = {
  id: string;
  lessonDate: string;
  lessonTitle: string | null;
  recordingUrl: string | null;
  notes: string | null;
  weekNumber: number;
  status?: string | null;
};

export type CohortLessonProgress = {
  completedCount: number;
  totalLessons: number;
  remainingCount: number;
  lastLessonDate: string | null;
  nextLessonAt: string | null;
  /** Title of the next curriculum lesson (by lesson_number), when known. */
  nextLessonTitle: string | null;
  entries: LessonLogEntrySummary[];
};

/** Cancelled logs must never count as completed weeks. */
export function isCountableLessonLogStatus(status: string | null | undefined): boolean {
  return status !== "Cancelled";
}

/** Assign week numbers by chronological order (date, then id). */
export function numberLessonLogEntries<T extends { id: string; lessonDate: string }>(
  entries: T[]
): Array<T & { weekNumber: number }> {
  const sorted = [...entries].sort((a, b) => {
    const byDate = a.lessonDate.localeCompare(b.lessonDate);
    if (byDate !== 0) return byDate;
    return a.id.localeCompare(b.id);
  });
  return sorted.map((entry, index) => ({ ...entry, weekNumber: index + 1 }));
}

/**
 * Next occurrence of the cohort weekly slot after the most recent logged lesson.
 * Uses weekly_session_start (ISO datetime with weekday+time) when available;
 * otherwise falls back to start_day_of_week at 12:00 UTC.
 *
 * When nothing is logged yet, floors at the cohort's real first session
 * (weekly_session_start / start_date) — never "next weekday from today" for a
 * cohort that hasn't started.
 */
export function computeNextLessonAfterLog(options: {
  weeklySessionStart: string | null;
  startDayOfWeek: string | null;
  lastLessonDate: string | null;
  /** Calendar start (YYYY-MM-DD or ISO). Used as a floor when no lessons are logged. */
  startDate?: string | null;
  from?: Date;
}): Date | null {
  const from = options.from ?? new Date();
  const lastLesson = options.lastLessonDate
    ? new Date(`${options.lastLessonDate}T23:59:59.999Z`)
    : null;

  const firstSession = resolveCohortFirstSession(
    options.weeklySessionStart,
    options.startDate ?? null
  );

  // No lessons logged yet and the first session is still ahead — that is next.
  if (!lastLesson && firstSession && firstSession > from) {
    return firstSession;
  }

  const after = lastLesson && lastLesson > from ? lastLesson : from;
  // Never project a weekly slot before the cohort's first session.
  const afterFloor =
    firstSession && firstSession > after
      ? new Date(firstSession.getTime() - 1)
      : after;

  if (options.weeklySessionStart?.includes("T")) {
    return nextWeeklyOccurrenceFromTemplate(options.weeklySessionStart, afterFloor);
  }

  const weekday = parseWeekdayName(options.startDayOfWeek);
  if (weekday == null) {
    return firstSession && firstSession > from ? firstSession : null;
  }

  return nextWeeklyOccurrenceOnWeekday(weekday, afterFloor, 12, 0);
}

/** Prefer weekly_session_start (real first slot); fall back to start_date calendar day. */
function resolveCohortFirstSession(
  weeklySessionStart: string | null,
  startDate: string | null
): Date | null {
  if (weeklySessionStart?.includes("T")) {
    const first = new Date(weeklySessionStart);
    if (!Number.isNaN(first.getTime())) return first;
  }

  if (!startDate) return null;
  const day = startDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return new Date(`${day}T12:00:00.000Z`);
}

function parseWeekdayName(value: string | null): number | null {
  if (!value?.trim()) return null;
  const key = value.trim().toLowerCase();
  const map: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };
  return map[key] ?? null;
}

function nextWeeklyOccurrenceFromTemplate(templateIso: string, after: Date): Date {
  const template = new Date(templateIso);
  if (Number.isNaN(template.getTime())) {
    return nextWeeklyOccurrenceOnWeekday(after.getUTCDay(), after, 12, 0);
  }

  const weekday = template.getUTCDay();
  const hours = template.getUTCHours();
  const minutes = template.getUTCMinutes();
  return nextWeeklyOccurrenceOnWeekday(weekday, after, hours, minutes);
}

function nextWeeklyOccurrenceOnWeekday(
  weekday: number,
  after: Date,
  hours: number,
  minutes: number
): Date {
  const candidate = new Date(
    Date.UTC(after.getUTCFullYear(), after.getUTCMonth(), after.getUTCDate(), hours, minutes, 0, 0)
  );
  const delta = (weekday - candidate.getUTCDay() + 7) % 7;
  candidate.setUTCDate(candidate.getUTCDate() + delta);
  if (candidate <= after) {
    candidate.setUTCDate(candidate.getUTCDate() + 7);
  }
  return candidate;
}

/** Next curriculum title assuming sequential delivery: lesson_number = completedCount + 1. */
export function resolveNextLessonTitle(
  lessonsOrdered: Array<{ lessonNumber: number; title: string }>,
  completedCount: number
): string | null {
  if (completedCount < 0) return null;
  const nextNumber = completedCount + 1;
  const byNumber = lessonsOrdered.find((lesson) => lesson.lessonNumber === nextNumber);
  if (byNumber) return byNumber.title;
  return lessonsOrdered[completedCount]?.title ?? null;
}

export function formatLessonProgressLabel(progress: {
  completedCount: number;
  totalLessons: number;
  nextLessonAt: string | null;
}): string {
  const fraction = `${progress.completedCount}/${progress.totalLessons || "?"}`;
  if (!progress.nextLessonAt) return fraction;
  const date = new Date(progress.nextLessonAt);
  if (Number.isNaN(date.getTime())) return fraction;
  const next = date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return `${fraction} · Next: ${next}`;
}
