/** Live deletes only when this is explicitly turned off. Unset stays a dry run. */
export function cleanupDryRunEnabled(
  env: { DATA_CLEANUP_DRY_RUN?: string } = {
    DATA_CLEANUP_DRY_RUN: process.env.DATA_CLEANUP_DRY_RUN,
  }
): boolean {
  const value = env.DATA_CLEANUP_DRY_RUN?.trim().toLowerCase();
  if (value === "0" || value === "false" || value === "off") return false;
  return true;
}

/** 03:25–03:45 Europe/London, so the 02:30 and 03:30 UTC crons cover BST and GMT. */
export function isLondonCleanupWindow(now = new Date()): boolean {
  const { hour, minute } = londonHourMinute(now);
  return hour === 3 && minute >= 25 && minute <= 45;
}

export function shouldNotifyCleanupFailure(
  previousStatus: string | null | undefined,
  currentFailed: boolean
): boolean {
  return currentFailed && previousStatus === "failed";
}

function londonHourMinute(now: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  return { hour, minute };
}
