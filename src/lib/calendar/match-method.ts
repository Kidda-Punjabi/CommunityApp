export type ScheduledSessionMatchMethod = NonNullable<
  import("@/lib/calendar/types").ScheduledSessionRow["match_method"]
>;

/** Admin-verified links — calendar sync must not rematch or delete these rows. */
export function isProtectedCalendarMatchMethod(
  method: string | null | undefined
): boolean {
  return method === "manual" || method === "calendar_link";
}

export function isWeeklyRrule(recurrence: string[] | null | undefined): boolean {
  if (!recurrence?.length) return false;
  const rrule = recurrence.find((line) => line.toUpperCase().startsWith("RRULE:"));
  if (!rrule) return false;
  const upper = rrule.toUpperCase();
  if (!upper.includes("FREQ=WEEKLY")) return false;
  const intervalMatch = upper.match(/INTERVAL=(\d+)/);
  if (intervalMatch && intervalMatch[1] !== "1") return false;
  return true;
}
