import { getLocalActivityDate } from "@/lib/progress/activity-date";

/** Monday (YYYY-MM-DD) for the week containing the given activity date. */
export function getWeekStartForActivityDate(activityDate: string): string {
  const normalized = activityDate.slice(0, 10);
  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  date.setUTCDate(date.getUTCDate() - daysFromMonday);

  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getCurrentWeekStart(activityDate = getLocalActivityDate()): string {
  return getWeekStartForActivityDate(activityDate);
}

/** Add calendar days to an activity date (YYYY-MM-DD). */
export function addActivityDays(activityDate: string, days: number): string {
  const [year, month, day] = activityDate.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function shiftWeekStart(weekStart: string, weeksDelta: number): string {
  return addActivityDays(weekStart, weeksDelta * 7);
}

export function getWeekEndDate(weekStart: string): string {
  return addActivityDays(weekStart, 6);
}

export function formatWeekRangeLabel(weekStart: string): string {
  const end = getWeekEndDate(weekStart);
  const startDate = parseActivityDate(weekStart);
  const endDate = parseActivityDate(end);

  const sameMonth = startDate.getUTCMonth() === endDate.getUTCMonth();
  const startLabel = startDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const endLabel = endDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: sameMonth ? undefined : "short",
    year: "numeric",
    timeZone: "UTC",
  });

  return `${startLabel} – ${endLabel}`;
}

function parseActivityDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function isFutureWeek(weekStart: string, currentWeekStart: string): boolean {
  return weekStart > currentWeekStart;
}
