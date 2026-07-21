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

export type CohortNotionWriteBackResult =
  | { ok: true; leadPageId: string }
  | { ok: false; reason: CohortNotionWriteBackSkipReason };

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

/**
 * Resolve a Notion lead page for cohort Confirmed write-back.
 * Always awaits lead create/link fully and prefers the returned page id —
 * do not race write-back against an in-flight lead step.
 */
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

  let linkResult: Awaited<ReturnType<typeof linkLeadsForProfile>>;
  try {
    linkResult = await linkLeadsForProfile(supabase, profileId, email);
  } catch (error) {
    console.error(
      `[cohort notion writeback] linkLeadsForProfile failed profile=${profileId}:`,
      error
    );
    linkResult = {
      linked: 0,
      created: 0,
      skipped: 1,
      conflicts: 0,
      ambiguous: 0,
      leadPageId: null,
    };
  }

  if (linkResult.leadPageId) {
    return { ok: true, leadPageId: linkResult.leadPageId };
  }

  if (linkResult.ambiguous > 0) {
    const leadPageIds = await findLeadPageIdsByEmailInCache(supabase, email);
    return {
      ok: false,
      reason: "ambiguous_lead",
      leadPageIds: [...new Set(leadPageIds)],
    };
  }

  // Final re-read — covers concurrent webhook that linked after our call started.
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

  const leadPageId = unique[0]!;
  const { error: forceLinkError } = await supabase
    .from("profiles")
    .update({ notion_lead_page_id: leadPageId })
    .eq("id", profileId)
    .is("notion_lead_page_id", null);
  if (forceLinkError) {
    console.error(
      `[cohort notion writeback] cache lead force-link failed profile=${profileId}:`,
      forceLinkError.message
    );
  }

  return { ok: true, leadPageId };
}

function notionPageIdsEqual(a: string, b: string): boolean {
  return a.replace(/-/g, "").toLowerCase() === b.replace(/-/g, "").toLowerCase();
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

  const confirmedIds = [
    ...new Set([
      ...confirmed.filter((id) => !notionPageIdsEqual(id, leadPageId)),
      leadPageId,
    ]),
  ];
  const interestedIds = interested.filter((id) => !notionPageIdsEqual(id, leadPageId));
  const waitingIds = waiting.filter((id) => !notionPageIdsEqual(id, leadPageId));

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

/** Remove a lead from Confirmed / Interested / Waiting for Payment on a Notion package page. */
export async function removeLeadFromCohortRelationsInNotion(
  notionPackagePageId: string,
  leadPageId: string
): Promise<void> {
  const [confirmed, interested, waiting] = await Promise.all([
    readPackageRelationIds(notionPackagePageId, "Confirmed"),
    readPackageRelationIds(notionPackagePageId, "Interested"),
    readPackageRelationIds(notionPackagePageId, "Waiting for Payment"),
  ]);

  const strip = (ids: string[]) => ids.filter((id) => !notionPageIdsEqual(id, leadPageId));

  await notionJson(`/pages/${notionPackagePageId}`, {
    method: "PATCH",
    body: JSON.stringify({
      properties: {
        Confirmed: { relation: strip(confirmed).map((id) => ({ id })) },
        Interested: { relation: strip(interested).map((id) => ({ id })) },
        "Waiting for Payment": { relation: strip(waiting).map((id) => ({ id })) },
      },
    }),
  });
}

/**
 * After admin withdrawal from a cohort, remove the student from Notion roster relations
 * (best-effort; never throws).
 */
export async function tryWriteBackCohortWithdrawalFromNotion(
  supabase: SupabaseClient,
  input: {
    userId: string;
    cohortId: string;
  }
): Promise<{ ok: boolean; skipped?: string }> {
  const { data: cohort, error: cohortError } = await supabase
    .from("cohorts")
    .select("id, name, notion_page_id")
    .eq("id", input.cohortId)
    .maybeSingle();

  if (cohortError) {
    console.error(`[cohort notion writeback] withdraw cohort load failed:`, cohortError.message);
    return { ok: false, skipped: cohortError.message };
  }

  const notionPageId = cohort?.notion_page_id?.trim() ?? null;
  if (!notionPageId) {
    logSkip("notion_cohort_withdraw_skipped_no_notion_page", {
      userId: input.userId,
      cohortId: input.cohortId,
    });
    return { ok: false, skipped: "no_notion_page" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("notion_lead_page_id")
    .eq("id", input.userId)
    .maybeSingle();

  const leadPageId = profile?.notion_lead_page_id?.trim() ?? null;
  if (!leadPageId) {
    logSkip("notion_cohort_withdraw_skipped_no_lead", {
      userId: input.userId,
      cohortId: input.cohortId,
    });
    return { ok: false, skipped: "no_lead" };
  }

  try {
    await removeLeadFromCohortRelationsInNotion(notionPageId, leadPageId);

    const page = await notionJson<{ properties: Record<string, unknown> }>(
      `/pages/${notionPageId}`
    );
    const rosterResult = await syncCohortRosterFromNotion(
      supabase,
      input.cohortId,
      page.properties,
      notionPageId
    );
    if (rosterResult.error) {
      console.error(
        `[cohort notion writeback] Roster refresh after withdraw PATCH failed cohort=${input.cohortId}:`,
        rosterResult.error
      );
    }

    return { ok: true };
  } catch (error) {
    logSkip("notion_cohort_withdraw_write_failed", {
      userId: input.userId,
      cohortId: input.cohortId,
      leadPageId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      skipped: error instanceof Error ? error.message : "notion_write_failed",
    };
  }
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

export async function resolveOpenCohortWriteBackAttention(
  supabase: SupabaseClient,
  userId: string,
  cohortId: string
): Promise<void> {
  const { error } = await supabase
    .from("notion_cohort_writeback_attention")
    .update({ resolved_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("cohort_id", cohortId)
    .is("resolved_at", null);

  if (error && !error.message.includes("notion_cohort_writeback_attention")) {
    console.error(
      `[cohort notion writeback] Failed to resolve attention user=${userId} cohort=${cohortId}:`,
      error.message
    );
  }
}

export async function hasOpenCohortWriteBackAttention(
  supabase: SupabaseClient,
  userId: string,
  cohortId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("notion_cohort_writeback_attention")
    .select("id")
    .eq("user_id", userId)
    .eq("cohort_id", cohortId)
    .is("resolved_at", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.message.includes("notion_cohort_writeback_attention")) return false;
    console.error(
      `[cohort notion writeback] Failed to check open attention:`,
      error.message
    );
    return false;
  }

  return Boolean(data?.id);
}

function logSkip(event: string, payload: Record<string, unknown>): void {
  console.error(`[cohort notion writeback] ${event}`, JSON.stringify(payload));
}

/**
 * After app enrollment, add the student to Notion Confirmed (best-effort; never throws).
 * Safe to call again on reconcile — Confirmed relation merge is idempotent.
 */
export async function tryWriteBackCohortConfirmedAfterEnrollment(
  supabase: SupabaseClient,
  input: {
    userId: string;
    cohortId: string;
    cohortName: string;
    notionPageId: string | null;
    email: string | null;
    /** When true, skip inserting a duplicate attention row if one is already open. */
    suppressDuplicateAttention?: boolean;
  }
): Promise<CohortNotionWriteBackResult> {
  const { userId, cohortId, cohortName, notionPageId, email } = input;

  const recordAttention = async (
    reason: CohortNotionWriteBackSkipReason,
    extras?: { leadPageIds?: string[]; details?: Record<string, unknown> }
  ) => {
    if (input.suppressDuplicateAttention) {
      const open = await hasOpenCohortWriteBackAttention(supabase, userId, cohortId);
      if (open) return;
    }
    await insertCohortNotionWriteBackAttention(supabase, {
      userId,
      cohortId,
      email,
      reason,
      leadPageIds: extras?.leadPageIds,
      details: { cohort_name: cohortName, ...extras?.details },
    });
  };

  if (!notionPageId) {
    logSkip("notion_cohort_confirm_skipped_no_notion_page", {
      userId,
      cohortId,
      cohortName,
      email,
    });
    await recordAttention("no_notion_page");
    return { ok: false, reason: "no_notion_page" };
  }

  if (!email?.trim()) {
    logSkip("notion_cohort_confirm_skipped_no_email", { userId, cohortId, cohortName });
    await recordAttention("no_lead", { details: { note: "No auth email on user." } });
    return { ok: false, reason: "no_lead" };
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
    await recordAttention("no_lead", {
      details: {
        resolve_error: error instanceof Error ? error.message : String(error),
      },
    });
    return { ok: false, reason: "no_lead" };
  }

  if (!leadResolution.ok) {
    if (leadResolution.reason === "ambiguous_lead") {
      logSkip("notion_cohort_confirm_skipped_ambiguous_lead", {
        userId,
        cohortId,
        email,
        leadPageIds: leadResolution.leadPageIds,
      });
      await recordAttention("ambiguous_lead", {
        leadPageIds: leadResolution.leadPageIds,
      });
      return { ok: false, reason: "ambiguous_lead" };
    }

    logSkip("notion_cohort_confirm_skipped_no_lead", { userId, cohortId, email });
    await recordAttention("no_lead");
    return { ok: false, reason: "no_lead" };
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

    await resolveOpenCohortWriteBackAttention(supabase, userId, cohortId);
    return { ok: true, leadPageId: leadResolution.leadPageId };
  } catch (error) {
    logSkip("notion_cohort_confirm_write_failed", {
      userId,
      cohortId,
      email,
      leadPageId: leadResolution.leadPageId,
      error: error instanceof Error ? error.message : String(error),
    });
    await recordAttention("notion_write_failed", {
      leadPageIds: [leadResolution.leadPageId],
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return { ok: false, reason: "notion_write_failed" };
  }
}
