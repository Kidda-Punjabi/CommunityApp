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
};

export type CohortLessonProgress = {
  completedCount: number;
  totalLessons: number;
  remainingCount: number;
  lastLessonDate: string | null;
  nextLessonAt: string | null;
  entries: LessonLogEntrySummary[];
};

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
 */
export function computeNextLessonAfterLog(options: {
  weeklySessionStart: string | null;
  startDayOfWeek: string | null;
  lastLessonDate: string | null;
  from?: Date;
}): Date | null {
  const from = options.from ?? new Date();
  const lastLesson = options.lastLessonDate
    ? new Date(`${options.lastLessonDate}T23:59:59.999Z`)
    : null;

  const after = lastLesson && lastLesson > from ? lastLesson : from;

  if (options.weeklySessionStart?.includes("T")) {
    return nextWeeklyOccurrenceFromTemplate(options.weeklySessionStart, after);
  }

  const weekday = parseWeekdayName(options.startDayOfWeek);
  if (weekday == null) return null;

  return nextWeeklyOccurrenceOnWeekday(weekday, after, 12, 0);
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
