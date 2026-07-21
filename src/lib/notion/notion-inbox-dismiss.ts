import type { SupabaseClient } from "@supabase/supabase-js";

export const INBOX_DISMISSAL_REASON_NOT_A_REAL_PACKAGE = "not_a_real_package";

export type InboxDismissal = {
  at: string;
  reason: string;
};

export function dismissalFromInboxRaw(
  raw: Record<string, unknown> | null | undefined
): InboxDismissal | null {
  const value = raw?._dismissal;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const at = typeof record.at === "string" ? record.at : null;
  const reason = typeof record.reason === "string" ? record.reason : null;
  if (!at || !reason) return null;
  return { at, reason };
}

export function isInboxRowDismissed(row: {
  dismissed_at?: string | null;
  raw_properties?: Record<string, unknown> | null;
}): boolean {
  if (row.dismissed_at) return true;
  return dismissalFromInboxRaw(row.raw_properties) != null;
}

export async function inboxDismissColumnsAvailable(
  supabase: SupabaseClient
): Promise<boolean> {
  const { error } = await supabase
    .from("notion_sync_inbox")
    .select("dismissed_at, dismissal_reason")
    .limit(1);
  return !error;
}

export async function dismissNotionInboxRows(
  supabase: SupabaseClient,
  inboxIds: string[],
  reason: string = INBOX_DISMISSAL_REASON_NOT_A_REAL_PACKAGE
): Promise<{ dismissed: number; error?: string }> {
  const ids = [...new Set(inboxIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return { dismissed: 0 };

  const hasDismissColumns = await inboxDismissColumnsAvailable(supabase);
  const hasCohortColumn = await supabase
    .from("notion_sync_inbox")
    .select("resolved_cohort_id")
    .limit(1)
    .then(({ error }) => !error);

  const { data: rows, error: loadError } = await supabase
    .from("notion_sync_inbox")
    .select("id, raw_properties, resolved")
    .in("id", ids)
    .eq("resolved", false);

  if (loadError) return { dismissed: 0, error: loadError.message };

  const dismissedAt = new Date().toISOString();
  let dismissed = 0;

  for (const row of rows ?? []) {
    const raw = (row.raw_properties as Record<string, unknown> | null) ?? {};
    const payload: Record<string, unknown> = {
      resolved: true,
      resolved_package_instance_id: null,
      raw_properties: {
        ...raw,
        _dismissal: {
          at: dismissedAt,
          reason,
        },
      },
    };

    if (hasCohortColumn) {
      payload.resolved_cohort_id = null;
    }
    if (hasDismissColumns) {
      payload.dismissed_at = dismissedAt;
      payload.dismissal_reason = reason;
    }

    const { error } = await supabase
      .from("notion_sync_inbox")
      .update(payload)
      .eq("id", row.id)
      .eq("resolved", false);

    if (error) return { dismissed, error: error.message };
    dismissed += 1;
  }

  return { dismissed };
}
