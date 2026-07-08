import type { SupabaseClient } from "@supabase/supabase-js";

type InboxLinkRow = {
  raw_properties: Record<string, unknown> | null;
  resolved_cohort_id?: string | null;
};

export function cohortIdFromInboxRow(row: InboxLinkRow | null | undefined): string | null {
  if (!row) return null;
  if (row.resolved_cohort_id) return row.resolved_cohort_id;
  const raw = row.raw_properties ?? {};
  const fromResolved = raw._resolved_cohort_id;
  return typeof fromResolved === "string" ? fromResolved : null;
}

export async function getCohortIdForNotionPage(
  supabase: SupabaseClient,
  notionPageId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("notion_sync_inbox")
    .select("raw_properties")
    .eq("notion_page_id", notionPageId)
    .maybeSingle();

  return cohortIdFromInboxRow(
    data ? { raw_properties: data.raw_properties as Record<string, unknown> | null } : undefined
  );
}

export async function cohortNotionColumnsAvailable(
  supabase: SupabaseClient
): Promise<boolean> {
  const { error } = await supabase.from("cohorts").select("notion_page_id").limit(1);
  return !error;
}

export async function inboxCohortLinkColumnAvailable(
  supabase: SupabaseClient
): Promise<boolean> {
  const { error } = await supabase
    .from("notion_sync_inbox")
    .select("resolved_cohort_id")
    .limit(1);
  return !error;
}

export async function saveCohortNotionLink(
  supabase: SupabaseClient,
  notionPageId: string,
  cohortId: string,
  patch: {
    packageName?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    status?: string | null;
    notionTutorUserId?: string | null;
    rawProperties?: Record<string, unknown>;
    rosterCache?: Array<Record<string, unknown>>;
  }
): Promise<void> {
  const { data: existing } = await supabase
    .from("notion_sync_inbox")
    .select("id, raw_properties")
    .eq("notion_page_id", notionPageId)
    .maybeSingle();

  const hasResolvedCohortColumn = await inboxCohortLinkColumnAvailable(supabase);

  const payload: Record<string, unknown> = {
    notion_page_id: notionPageId,
    package_name: patch.packageName ?? null,
    start_date: patch.startDate ?? null,
    end_date: patch.endDate ?? null,
    status: patch.status ?? null,
    notion_tutor_user_id: patch.notionTutorUserId ?? null,
    resolved: true,
    raw_properties: {
      ...(existing?.raw_properties as Record<string, unknown> | undefined),
      ...(patch.rawProperties ?? {}),
      _resolved_cohort_id: cohortId,
      ...(patch.rosterCache ? { _roster_cache: patch.rosterCache } : {}),
    },
  };

  if (hasResolvedCohortColumn) {
    payload.resolved_cohort_id = cohortId;
    payload.resolved_package_instance_id = null;
  }

  if (existing) {
    await supabase.from("notion_sync_inbox").update(payload).eq("id", existing.id);
    return;
  }

  await supabase.from("notion_sync_inbox").insert(payload);
}

export async function listNotionLinkedCohortIds(
  supabase: SupabaseClient
): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  const hasNotionColumns = await cohortNotionColumnsAvailable(supabase);
  if (hasNotionColumns) {
    const { data: cohorts } = await supabase
      .from("cohorts")
      .select("id, notion_page_id")
      .not("notion_page_id", "is", null);
    for (const row of cohorts ?? []) {
      if (row.notion_page_id) map.set(row.notion_page_id, row.id);
    }
  }

  const { data: inboxRows } = await supabase
    .from("notion_sync_inbox")
    .select("notion_page_id, raw_properties")
    .eq("resolved", true);

  for (const row of inboxRows ?? []) {
    const cohortId = cohortIdFromInboxRow(row);
    if (cohortId) map.set(row.notion_page_id, cohortId);
  }

  return map;
}
