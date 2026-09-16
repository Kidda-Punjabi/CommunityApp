/** Pure helpers for Lessons Log incremental pull + failure retries. */

export function mergeLessonLogPagesById<T extends { pageId: string; lastEditedTime: string }>(
  incremental: T[],
  retries: T[]
): T[] {
  const byId = new Map<string, T>();
  for (const page of incremental) {
    byId.set(page.pageId, page);
  }
  for (const page of retries) {
    const existing = byId.get(page.pageId);
    if (!existing || page.lastEditedTime > existing.lastEditedTime) {
      byId.set(page.pageId, page);
    }
  }
  return [...byId.values()];
}

/**
 * Watermark only moves to the newest successfully processed last_edited_time.
 * Failed pages must not advance it (they are retried via the failures table).
 */
export function nextLessonLogWatermark(
  storedWatermark: string | null,
  successfulLastEditedTimes: string[]
): string | null {
  let maxSuccessful: string | null = null;
  for (const time of successfulLastEditedTimes) {
    if (!time.trim()) continue;
    if (!maxSuccessful || time > maxSuccessful) {
      maxSuccessful = time;
    }
  }
  if (!maxSuccessful) return storedWatermark;
  if (!storedWatermark || maxSuccessful > storedWatermark) return maxSuccessful;
  return storedWatermark;
}
