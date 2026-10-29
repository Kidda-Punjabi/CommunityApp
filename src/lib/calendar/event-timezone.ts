import { localDateKey } from "@/lib/calendar/day-bounds";

/** Used when a Google event has no start.timeZone. */
export const LESSON_LOG_TIMEZONE_FALLBACK = "Europe/London";

export function googleEventTimeZone(
  start?: { timeZone?: string | null } | null,
  end?: { timeZone?: string | null } | null
): string | null {
  const zone = start?.timeZone?.trim() || end?.timeZone?.trim() || "";
  return zone || null;
}

export function eventTimeZone(timeZone: string | null | undefined): string {
  const zone = timeZone?.trim();
  return zone || LESSON_LOG_TIMEZONE_FALLBACK;
}

/** Calendar date of an instant in the event timezone (London when the zone is missing). */
export function lessonDateInEventTimeZone(
  startsAt: string,
  timeZone: string | null | undefined
): string {
  return localDateKey(startsAt, eventTimeZone(timeZone));
}

/**
 * Notion date properties are either YYYY-MM-DD or a datetime.
 * Date-only values are kept. Datetimes are converted in the event timezone
 * so a UTC instant does not become the pay date.
 */
export function lessonDateFromNotionStart(
  start: string | null | undefined,
  timeZone?: string | null
): string | null {
  const trimmed = start?.trim() ?? "";
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    return match?.[1] ?? null;
  }
  return lessonDateInEventTimeZone(parsed.toISOString(), timeZone);
}

export function utcDateKey(iso: string): string | null {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}
