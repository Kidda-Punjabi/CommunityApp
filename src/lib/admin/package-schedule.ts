export const PACKAGE_WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type PackageWeekday = (typeof PACKAGE_WEEKDAYS)[number];

/** `YYYY-MM-DD` from an ISO / timestamptz string without timezone day shifts. */
export function dateInputFromIso(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

/** Store calendar dates at noon UTC so the calendar day is stable in all timezones. */
export function isoFromDateInput(value: string): string | null {
  if (!value) return null;
  return `${value}T12:00:00.000Z`;
}

export function weekdayFromDateInput(value: string): PackageWeekday | "" {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  const index = (date.getUTCDay() + 6) % 7;
  return PACKAGE_WEEKDAYS[index] ?? "";
}
