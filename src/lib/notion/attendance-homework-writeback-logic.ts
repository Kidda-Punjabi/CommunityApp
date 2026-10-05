export const WRITEBACK_BATCH_SIZE = 25;
export const WRITEBACK_MAX_ATTEMPTS = 5;

export const LEADS_APP_USER_ID_PROPERTY = "App User ID";
export const LEADS_KID_PROFILE_ID_PROPERTY = "Kid Profile ID";

export type WritebackKind = "attendance" | "homework";
export type WritebackStatus = "pending" | "sent" | "failed" | "skipped";

export type LookupCount = "none" | "one" | "many";

export function notionPageIdsEqual(a: string, b: string): boolean {
  return a.replace(/-/g, "").toLowerCase() === b.replace(/-/g, "").toLowerCase();
}

export function uniqueNotionIds(ids: string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const trimmed = id.trim();
    if (!trimmed) continue;
    if (!out.some((existing) => notionPageIdsEqual(existing, trimmed))) {
      out.push(trimmed);
    }
  }
  return out;
}

export function classifyLookupCount(ids: string[]): LookupCount {
  const unique = uniqueNotionIds(ids);
  if (unique.length === 0) return "none";
  if (unique.length === 1) return "one";
  return "many";
}

export function mergeRelationIds(
  existing: string[],
  add: string
): { next: string[]; changed: boolean } {
  const merged = uniqueNotionIds([...existing, add]);
  const alreadyPresent = uniqueNotionIds(existing).some((id) =>
    notionPageIdsEqual(id, add)
  );
  return { next: merged, changed: !alreadyPresent };
}

export function shouldRetryFailed(attempts: number, maxAttempts = WRITEBACK_MAX_ATTEMPTS): boolean {
  return attempts < maxAttempts;
}

export const APP_LOG_WRITEBACK_SKIP = "covered by app log";

export type AppLogCoverageRow = {
  cohortId: string | null;
  packageInstanceId: string | null;
  lessonId: string | null;
  source: string | null;
  notionSyncStatus: string | null;
};

/** True when a synced app lesson log already covers this queue item's cohort or package. */
export function logCoversQueueTarget(
  logs: AppLogCoverageRow[],
  target: { cohortId: string | null; packageInstanceIds: string[]; lessonId: string }
): boolean {
  return logs.some((log) => {
    if (log.lessonId !== target.lessonId) return false;
    if (log.source !== "app" || log.notionSyncStatus !== "synced") return false;
    if (target.cohortId && log.cohortId === target.cohortId) return true;
    return Boolean(
      log.packageInstanceId && target.packageInstanceIds.includes(log.packageInstanceId)
    );
  });
}

export function relationPropertyForKind(kind: WritebackKind): "Attendees" | "Homework" {
  return kind === "attendance" ? "Attendees" : "Homework";
}

/**
 * Attendance is already written by the app lesson log.
 * Homework still has to be written onto that same page.
 */
export function writebackWhenAppLessonLogExists(
  kind: WritebackKind
): "skip" | "use-app-page" {
  return kind === "homework" ? "use-app-page" : "skip";
}
