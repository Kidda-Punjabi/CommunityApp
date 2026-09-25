function utcCalendarDay(value: string): string | null {
  const day = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

/** Today as YYYY-MM-DD in UTC, matching cohort start_date calendar days. */
export function utcToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function formatNextCohortStartNote(
  startDate: string | null | undefined
): string | undefined {
  const day = startDate ? utcCalendarDay(startDate) : null;
  if (!day) return undefined;
  const label = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
  return `Next cohort starts: ${label}`;
}

export function isUpcomingCohortStart(
  startDate: string | null | undefined,
  today: string
): boolean {
  const day = startDate ? utcCalendarDay(startDate) : null;
  return day != null && day >= today;
}
