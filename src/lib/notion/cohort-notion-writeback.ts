import "server-only";

import { notionJson, relationIds } from "@/lib/notion/client";
import { linkLeadsForProfile } from "@/lib/notion/lead-sync";
import { syncCohortRosterFromNotion } from "@/lib/notion/package-roster-sync";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CohortNotionWriteBackSkipReason =
  | "no_notion_page"
  | "no_lead"
  | "ambiguous_lead"
  | "notion_write_failed";

export type ResolveLeadPageResult =
  | { ok: true; leadPageId: string }
  | { ok: false; reason: "no_lead" | "ambiguous_lead"; leadPageIds: string[] };

async function findLeadPageIdsByEmailInCache(
  supabase: SupabaseClient,
  email: string
): Promise<string[]> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return [];

  const { data, error } = await supabase
    .from("notion_leads_cache")
    .select("notion_page_id, email")
    .not("email", "is", null);

  if (error) {
    if (error.message.includes("notion_leads_cache")) {
      return [];
    }
    throw new Error(error.message);
  }

  return (data ?? [])
    .filter((row) => row.email?.trim().toLowerCase() === normalized)
    .map((row) => row.notion_page_id)
    .filter((id): id is string => Boolean(id));
}

export async function resolveLeadPageIdForCohortWriteBack(
  supabase: SupabaseClient,
  profileId: string,
  email: string
): Promise<ResolveLeadPageResult> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("notion_lead_page_id")
    .eq("id", profileId)
    .maybeSingle();

  if (profile?.notion_lead_page_id) {
    return { ok: true, leadPageId: profile.notion_lead_page_id };
  }

  try {
    await linkLeadsForProfile(supabase, profileId, email);
  } catch (error) {
    console.error(
      `[cohort notion writeback] linkLeadsForProfile failed profile=${profileId}:`,
      error
    );
  }

  const { data: profileAfterLink } = await supabase
    .from("profiles")
    .select("notion_lead_page_id")
    .eq("id", profileId)
    .maybeSingle();

  if (profileAfterLink?.notion_lead_page_id) {
    return { ok: true, leadPageId: profileAfterLink.notion_lead_page_id };
  }

  const leadPageIds = await findLeadPageIdsByEmailInCache(supabase, email);
  const unique = [...new Set(leadPageIds)];

  if (unique.length === 0) {
    return { ok: false, reason: "no_lead", leadPageIds: [] };
  }

  if (unique.length > 1) {
    return { ok: false, reason: "ambiguous_lead", leadPageIds: unique };
  }

  return { ok: true, leadPageId: unique[0]! };
}

async function readPackageRelationIds(
  notionPackagePageId: string,
  property: string
): Promise<string[]> {
  const page = await notionJson<{ properties: Record<string, unknown> }>(
    `/pages/${notionPackagePageId}`
  );
  const prop = page.properties[property] as { relation?: Array<{ id?: string }> } | undefined;
  return relationIds(prop);
}

export async function addLeadToCohortConfirmedInNotion(
  notionPackagePageId: string,
  leadPageId: string
): Promise<void> {
  const [confirmed, interested, waiting] = await Promise.all([
    readPackageRelationIds(notionPackagePageId, "Confirmed"),
    readPackageRelationIds(notionPackagePageId, "Interested"),
    readPackageRelationIds(notionPackagePageId, "Waiting for Payment"),
  ]);

  const confirmedSet = new Set(confirmed);
  confirmedSet.add(leadPageId);
  const confirmedIds = [...confirmedSet];

  const interestedIds = interested.filter((id) => id !== leadPageId);
  const waitingIds = waiting.filter((id) => id !== leadPageId);

  const properties: Record<string, { relation: Array<{ id: string }> }> = {
    Confirmed: { relation: confirmedIds.map((id) => ({ id })) },
    Interested: { relation: interestedIds.map((id) => ({ id })) },
    "Waiting for Payment": { relation: waitingIds.map((id) => ({ id })) },
  };

  await notionJson(`/pages/${notionPackagePageId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties }),
  });
}

export async function insertCohortNotionWriteBackAttention(
  supabase: SupabaseClient,
  input: {
    userId: string;
    cohortId: string;
    email: string | null;
    reason: CohortNotionWriteBackSkipReason;
    leadPageIds?: string[];
    details?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await supabase.from("notion_cohort_writeback_attention").insert({
    user_id: input.userId,
    cohort_id: input.cohortId,
    email: input.email,
    reason: input.reason,
    lead_page_ids: input.leadPageIds ?? [],
    details: input.details ?? {},
  });

  if (error) {
    console.error(
      `[cohort notion writeback] Failed to insert admin attention:`,
      error.message
    );
  }
}

function logSkip(event: string, payload: Record<string, unknown>): void {
  console.error(`[cohort notion writeback] ${event}`, JSON.stringify(payload));
}

/**
 * After app enrollment, add the student to Notion Confirmed (best-effort; never throws).
 */
export async function tryWriteBackCohortConfirmedAfterEnrollment(
  supabase: SupabaseClient,
  input: {
    userId: string;
    cohortId: string;
    cohortName: string;
    notionPageId: string | null;
    email: string | null;
  }
): Promise<void> {
  const { userId, cohortId, cohortName, notionPageId, email } = input;

  if (!notionPageId) {
    logSkip("notion_cohort_confirm_skipped_no_notion_page", {
      userId,
      cohortId,
      cohortName,
      email,
    });
    await insertCohortNotionWriteBackAttention(supabase, {
      userId,
      cohortId,
      email,
      reason: "no_notion_page",
      details: { cohort_name: cohortName },
    });
    return;
  }

  if (!email?.trim()) {
    logSkip("notion_cohort_confirm_skipped_no_email", { userId, cohortId, cohortName });
    await insertCohortNotionWriteBackAttention(supabase, {
      userId,
      cohortId,
      email: null,
      reason: "no_lead",
      details: { cohort_name: cohortName, note: "No auth email on user." },
    });
    return;
  }

  let leadResolution: ResolveLeadPageResult;
  try {
    leadResolution = await resolveLeadPageIdForCohortWriteBack(supabase, userId, email);
  } catch (error) {
    logSkip("notion_cohort_confirm_skipped_lead_resolve_error", {
      userId,
      cohortId,
      email,
      error: error instanceof Error ? error.message : String(error),
    });
    await insertCohortNotionWriteBackAttention(supabase, {
      userId,
      cohortId,
      email,
      reason: "no_lead",
      details: {
        cohort_name: cohortName,
        resolve_error: error instanceof Error ? error.message : String(error),
      },
    });
    return;
  }

  if (!leadResolution.ok) {
    if (leadResolution.reason === "ambiguous_lead") {
      logSkip("notion_cohort_confirm_skipped_ambiguous_lead", {
        userId,
        cohortId,
        email,
        leadPageIds: leadResolution.leadPageIds,
      });
      await insertCohortNotionWriteBackAttention(supabase, {
        userId,
        cohortId,
        email,
        reason: "ambiguous_lead",
        leadPageIds: leadResolution.leadPageIds,
        details: { cohort_name: cohortName },
      });
      return;
    }

    logSkip("notion_cohort_confirm_skipped_no_lead", { userId, cohortId, email });
    await insertCohortNotionWriteBackAttention(supabase, {
      userId,
      cohortId,
      email,
      reason: "no_lead",
      details: { cohort_name: cohortName },
    });
    return;
  }

  try {
    await addLeadToCohortConfirmedInNotion(notionPageId, leadResolution.leadPageId);

    const page = await notionJson<{ properties: Record<string, unknown> }>(
      `/pages/${notionPageId}`
    );
    const rosterResult = await syncCohortRosterFromNotion(
      supabase,
      cohortId,
      page.properties,
      notionPageId
    );
    if (rosterResult.error) {
      console.error(
        `[cohort notion writeback] Roster refresh after PATCH failed cohort=${cohortId}:`,
        rosterResult.error
      );
    }
  } catch (error) {
    logSkip("notion_cohort_confirm_write_failed", {
      userId,
      cohortId,
      email,
      leadPageId: leadResolution.leadPageId,
      error: error instanceof Error ? error.message : String(error),
    });
    await insertCohortNotionWriteBackAttention(supabase, {
      userId,
      cohortId,
      email,
      reason: "notion_write_failed",
      leadPageIds: [leadResolution.leadPageId],
      details: {
        cohort_name: cohortName,
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }
}
