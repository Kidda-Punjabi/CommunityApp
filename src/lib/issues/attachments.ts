import type { IssueAttachment } from "@/lib/issues/types";

export function parseIssueAttachments(value: unknown): IssueAttachment[] {
  if (!Array.isArray(value)) return [];
  const items: IssueAttachment[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.path !== "string" || !record.path.trim()) continue;
    if (record.path.includes("..")) continue;
    items.push({
      path: record.path.trim(),
      name: typeof record.name === "string" && record.name.trim() ? record.name.trim() : "file",
      mime_type: typeof record.mime_type === "string" ? record.mime_type : "",
      size: typeof record.size === "number" && Number.isFinite(record.size) ? record.size : 0,
    });
  }
  return items.slice(0, 5);
}

export function isEmailFailed(row: {
  email_sent_at: string | null;
  email_error: string | null;
}): boolean {
  return !row.email_sent_at && Boolean(row.email_error?.trim());
}
