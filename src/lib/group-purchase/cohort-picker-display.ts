/** Matches checkout freshness gate (1.5× 10-minute Notion cron). */
export const COHORT_NOTION_FRESHNESS_MS = 15 * 60 * 1000;

export function isCohortNotionSyncFresh(
  notionSyncedAt: string | null | undefined,
  nowMs = Date.now()
): boolean {
  if (!notionSyncedAt) return false;
  const syncedMs = new Date(notionSyncedAt).getTime();
  if (Number.isNaN(syncedMs)) return false;
  return nowMs - syncedMs <= COHORT_NOTION_FRESHNESS_MS;
}

export function formatWeeklySessionTimeLabel(
  startIso: string | null,
  endIso: string | null,
  hasTime: boolean
): string {
  if (!hasTime || !startIso) {
    return "Time to be confirmed";
  }

  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;

  const timeFmt = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  const startLabel = timeFmt.format(start);
  if (!end || Number.isNaN(end.getTime())) {
    return startLabel;
  }

  return `${startLabel}–${timeFmt.format(end)}`;
}
