export const CALENDAR_AUTO_SYNC_INTERVAL_MS = 10 * 60 * 1000;

export function shouldAutoSyncCalendar(lastSyncedAt: string | null | undefined): boolean {
  if (!lastSyncedAt) return true;
  const lastMs = new Date(lastSyncedAt).getTime();
  if (Number.isNaN(lastMs)) return true;
  return Date.now() - lastMs >= CALENDAR_AUTO_SYNC_INTERVAL_MS;
}
