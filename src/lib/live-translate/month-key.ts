/** UTC calendar month key, e.g. `2026-07` — mirrors speaking practice. */
export function currentMonthKeyUtc(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/** Human-readable reset date for the 1st of the month after `monthKey`. */
export function nextMonthResetLabel(monthKey: string): string {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return "the 1st of next month";
  }

  const reset = new Date(Date.UTC(year, month, 1));
  return reset.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatSecondsRemaining(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  if (minutes <= 0) return `${remainder}s left this month`;
  if (remainder === 0) return `${minutes}m left this month`;
  return `${minutes}m ${remainder}s left this month`;
}
