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

export function relationPropertyForKind(kind: WritebackKind): "Attendees" | "Homework" {
  return kind === "attendance" ? "Attendees" : "Homework";
}
