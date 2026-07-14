/** First day of the calendar month containing `isoDate` (YYYY-MM-DD). */
export function getMonthStart(isoDate: string): string {
  const [year, month] = isoDate.slice(0, 10).split("-").map(Number);
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/** Exclusive end bound for a month range: first day of the following month. */
export function getNextMonthStart(monthStart: string): string {
  const [year, month] = monthStart.slice(0, 10).split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1 + 1, 1));
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

/** Previous full calendar month (relative to local today by default). */
export function getPreviousMonthStart(today = new Date()): string {
  const y = today.getFullYear();
  const m = today.getMonth();
  const prev = new Date(y, m - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-01`;
}

export function getCurrentMonthStart(today = new Date()): string {
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

/** e.g. "June 2026" */
export function formatMonthLabel(monthStart: string): string {
  const [year, month] = monthStart.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Normalize a month picker value (YYYY-MM or YYYY-MM-DD) to month_start. */
export function normalizeMonthStart(value: string): string | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return `${trimmed}-01`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return getMonthStart(trimmed);
  }
  return null;
}

/** Value for `<input type="month">`. */
export function toMonthInputValue(monthStart: string): string {
  return monthStart.slice(0, 7);
}
