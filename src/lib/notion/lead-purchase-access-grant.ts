import "server-only";

import { setPackageRunRosterStatus } from "@/lib/admin/packages/roster-membership";
import {
  notionJson,
  plainTextFromRichText,
  plainTextFromTitle,
  relationIds,
} from "@/lib/notion/client";
import type { LinkLeadsForProfileResult } from "@/lib/notion/lead-sync";
import type { SupabaseClient } from "@supabase/supabase-js";

export type LeadPurchaseGrantResult = {
  attempted: boolean;
  granted: number;
  queued: number;
  skipped: number;
  errors: string[];
  details: string[];
};

type ResolvedPackageTarget =
  | {
      kind: "cohort";
      runId: string;
      courseId: string;
      packageId: string;
      label: string;
      notionPageId: string;
    }
  | {
      kind: "package_instance";
      runId: string;
      courseId: string;
      packageId: string;
      label: string;
      notionPageId: string;
    };

function leadNameFromPage(properties: Record<string, unknown>): string | null {
  const props = properties as Record<string, { title?: Array<{ plain_text?: string }> }>;
  return plainTextFromTitle(props.Name) || null;
}

function leadEmailFromPage(properties: Record<string, unknown>): string | null {
  const props = properties as Record<
    string,
    { email?: string; rich_text?: Array<{ plain_text?: string }> }
  >;
  for (const key of ["Email", "Email (Copy)"]) {
    const emailProp = props[key];
    if (!emailProp) continue;
    if ("email" in emailProp && emailProp.email?.trim()) {
      return emailProp.email.trim();
    }
    const fromRichText = plainTextFromRichText(emailProp);
    if (fromRichText) return fromRichText;
  }
  return null;
}

async function resolveNotionPackagePage(
  supabase: SupabaseClient,
  notionPageId: string
): Promise<ResolvedPackageTarget | { error: string; notionPageId: string }> {
  const { data: cohort, error: cohortError } = await supabase
    .from("cohorts")
    .select("id, name, course_id")
    .eq("notion_page_id", notionPageId)
    .maybeSingle();

  if (cohortError) {
    return { error: cohortError.message, notionPageId };
  }

  const { data: instance, error: instanceError } = await supabase
    .from("package_instances")
    .select("id, name, course_id, package_id")
    .eq("notion_page_id", notionPageId)
    .maybeSingle();

  if (instanceError) {
    return { error: instanceError.message, notionPageId };
  }

  if (cohort && instance) {
    return {
      error: "Notion package page matches both a cohort and a package_instance.",
      notionPageId,
    };
  }

  if (cohort) {
    if (!cohort.course_id) {
      return { error: "Matched cohort has no course_id.", notionPageId };
    }
    const { data: groupPkg, error: pkgError } = await supabase
      .from("packages")
      .select("id")
      .eq("course_id", cohort.course_id)
      .eq("delivery_mode", "group")
      .maybeSingle();
    if (pkgError) return { error: pkgError.message, notionPageId };
    if (!groupPkg) {
      return { error: "No group package product for matched cohort course.", notionPageId };
    }
    return {
      kind: "cohort",
      runId: cohort.id,
      courseId: cohort.course_id,
      packageId: groupPkg.id,
      label: cohort.name,
      notionPageId,
    };
  }

  if (instance) {
    if (!instance.course_id || !instance.package_id) {
      return { error: "Matched package_instance missing course_id/package_id.", notionPageId };
    }
    return {
      kind: "package_instance",
      runId: instance.id,
      courseId: instance.course_id,
      packageId: instance.package_id,
      label: instance.name ?? "Package instance",
      notionPageId,
    };
  }

  return { error: "No cohort or package_instance with this notion_page_id.", notionPageId };
}

async function ensureCohortMembership(
  supabase: SupabaseClient,
  cohortId: string,
  userId: string
): Promise<{ error?: string }> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("cohort_members").upsert(
    {
      cohort_id: cohortId,
      user_id: userId,
      joined_at: now,
      left_at: null,
    },
    { onConflict: "cohort_id,user_id" }
  );
  if (error) return { error: error.message };
  return {};
}

async function enqueueLeadPurchaseGrant(
  supabase: SupabaseClient,
  input: {
    profileId: string;
    notionLeadPageId: string;
    leadEmail: string | null;
    leadName: string | null;
    reason: string;
    rawPackageData: Record<string, unknown>;
  }
): Promise<{ queued: boolean; error?: string }> {
  const { data: existing } = await supabase
    .from("notion_lead_purchase_grant_queue")
    .select("id")
    .eq("profile_id", input.profileId)
    .eq("notion_lead_page_id", input.notionLeadPageId)
    .eq("reason", input.reason)
    .eq("resolved", false)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("notion_lead_purchase_grant_queue")
      .update({
        lead_email: input.leadEmail,
        lead_name: input.leadName,
        raw_package_data: input.rawPackageData,
      })
      .eq("id", existing.id);
    if (error) return { queued: false, error: error.message };
    return { queued: true };
  }

  const { error } = await supabase.from("notion_lead_purchase_grant_queue").insert({
    profile_id: input.profileId,
    notion_lead_page_id: input.notionLeadPageId,
    lead_email: input.leadEmail,
    lead_name: input.leadName,
    reason: input.reason,
    raw_package_data: input.rawPackageData,
    resolved: false,
  });

  if (error) {
    if (error.message.includes("notion_lead_purchase_grant_queue")) {
      console.error(
        "[lead purchase grant] queue table missing — apply supabase/notion-lead-purchase-grant-queue.sql"
      );
      return { queued: false, error: error.message };
    }
    return { queued: false, error: error.message };
  }

  return { queued: true };
}

async function grantResolvedTarget(
  supabase: SupabaseClient,
  profileId: string,
  target: ResolvedPackageTarget
): Promise<{ error?: string }> {
  // course_enrollments has a DB guard requiring an active cohort_members row first
  // (same order as complete_group_purchase_core). Membership before enrollment.
  if (target.kind === "cohort") {
    const member = await ensureCohortMembership(supabase, target.runId, profileId);
    if (member.error) return { error: member.error };
  }

  const kind = target.kind === "cohort" ? "cohort" : "package_instance";
  const result = await setPackageRunRosterStatus(supabase, {
    kind,
    runId: target.runId,
    userId: profileId,
    status: "confirmed",
    courseId: target.courseId,
    packageId: target.packageId,
  });
  if (result.error) return { error: result.error };

  return {};
}

/**
 * After a profile is linked to a Notion lead, grant course access from the lead's
 * Packages relation. Never throws to callers — failures are logged / queued.
 *
 * - 0 Packages → no-op (normal unpaid signup)
 * - Exactly one cleanly resolved package → auto-grant
 * - Multiple / unresolvable → queue for admin
 */
export async function grantAccessFromLinkedLeadPackages(
  supabase: SupabaseClient,
  profileId: string,
  leadPageId: string
): Promise<LeadPurchaseGrantResult> {
  const result: LeadPurchaseGrantResult = {
    attempted: true,
    granted: 0,
    queued: 0,
    skipped: 0,
    errors: [],
    details: [],
  };

  let leadProperties: Record<string, unknown>;
  try {
    const page = await notionJson<{ properties: Record<string, unknown> }>(
      `/pages/${leadPageId}`
    );
    leadProperties = page.properties ?? {};
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notion lead fetch failed.";
    console.error(
      `[lead purchase grant] Notion fetch failed profile=${profileId} lead=${leadPageId}:`,
      message
    );
    result.errors.push(message);
    return result;
  }

  const leadEmail = leadEmailFromPage(leadProperties);
  const leadName = leadNameFromPage(leadProperties);
  const packagePageIds = relationIds(
    leadProperties.Packages as { relation?: Array<{ id?: string }> } | undefined
  );

  if (packagePageIds.length === 0) {
    result.skipped = 1;
    result.details.push("No Packages relation — nothing to grant.");
    return result;
  }

  const resolved: ResolvedPackageTarget[] = [];
  const unresolved: Array<{ notionPageId: string; error: string }> = [];

  for (const packagePageId of packagePageIds) {
    const match = await resolveNotionPackagePage(supabase, packagePageId);
    if ("kind" in match) {
      resolved.push(match);
    } else {
      unresolved.push({ notionPageId: match.notionPageId, error: match.error });
    }
  }

  const rawPackageData = {
    packagePageIds,
    resolved: resolved.map((r) => ({
      kind: r.kind,
      runId: r.runId,
      courseId: r.courseId,
      label: r.label,
      notionPageId: r.notionPageId,
    })),
    unresolved,
  };

  const isCleanSingle = resolved.length === 1 && unresolved.length === 0 && packagePageIds.length === 1;

  if (!isCleanSingle) {
    const reason =
      packagePageIds.length > 1
        ? "ambiguous_multiple_packages"
        : unresolved.length > 0
          ? "unresolvable_package"
          : "ambiguous_package_match";

    const queued = await enqueueLeadPurchaseGrant(supabase, {
      profileId,
      notionLeadPageId: leadPageId,
      leadEmail,
      leadName,
      reason,
      rawPackageData,
    });
    if (queued.error) result.errors.push(queued.error);
    if (queued.queued) {
      result.queued = 1;
      result.details.push(`Queued (${reason}).`);
    } else {
      result.details.push(`Could not queue (${reason}).`);
    }
    return result;
  }

  const target = resolved[0]!;
  const grant = await grantResolvedTarget(supabase, profileId, target);
  if (grant.error) {
    result.errors.push(grant.error);
    const queued = await enqueueLeadPurchaseGrant(supabase, {
      profileId,
      notionLeadPageId: leadPageId,
      leadEmail,
      leadName,
      reason: "grant_failed",
      rawPackageData: { ...rawPackageData, grantError: grant.error },
    });
    if (queued.queued) result.queued = 1;
    return result;
  }

  result.granted = 1;
  result.details.push(`Granted ${target.kind} ${target.label} (${target.runId}).`);
  return result;
}

/** Best-effort follow-up after linkLeadsForProfile — never throws. */
export async function maybeGrantAccessAfterLeadLink(
  supabase: SupabaseClient,
  profileId: string,
  linkResult: Pick<LinkLeadsForProfileResult, "leadPageId" | "ambiguous" | "conflicts">
): Promise<LeadPurchaseGrantResult | null> {
  if (!linkResult.leadPageId) return null;
  // Ambiguous lead match did not produce a trustworthy single lead page.
  if (linkResult.ambiguous > 0) return null;

  try {
    return await grantAccessFromLinkedLeadPackages(
      supabase,
      profileId,
      linkResult.leadPageId
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Purchase grant failed.";
    console.error(
      `[lead purchase grant] unexpected failure profile=${profileId}:`,
      message
    );
    return {
      attempted: true,
      granted: 0,
      queued: 0,
      skipped: 0,
      errors: [message],
      details: [],
    };
  }
}

export async function resolveLeadPurchaseGrantQueueItem(
  supabase: SupabaseClient,
  input: {
    queueId: string;
    resolvedBy: string;
    action: "dismiss" | "grant";
    kind?: "cohort" | "package_instance";
    runId?: string;
    note?: string | null;
  }
): Promise<{ error?: string; success?: string }> {
  const { data: row, error: loadError } = await supabase
    .from("notion_lead_purchase_grant_queue")
    .select("id, profile_id, resolved, raw_package_data")
    .eq("id", input.queueId)
    .maybeSingle();

  if (loadError) return { error: loadError.message };
  if (!row) return { error: "Queue item not found." };
  if (row.resolved) return { error: "Already resolved." };

  if (input.action === "dismiss") {
    const { error } = await supabase
      .from("notion_lead_purchase_grant_queue")
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: input.resolvedBy,
        resolution_note: input.note ?? "Dismissed without grant.",
      })
      .eq("id", input.queueId);
    if (error) return { error: error.message };
    return { success: "Dismissed." };
  }

  if (!input.kind || !input.runId) {
    return { error: "Choose a cohort or package instance to grant." };
  }

  let target: ResolvedPackageTarget | null = null;
  if (input.kind === "cohort") {
    const { data: cohort } = await supabase
      .from("cohorts")
      .select("id, name, course_id, notion_page_id")
      .eq("id", input.runId)
      .maybeSingle();
    if (!cohort?.course_id) return { error: "Cohort not found." };
    const { data: groupPkg } = await supabase
      .from("packages")
      .select("id")
      .eq("course_id", cohort.course_id)
      .eq("delivery_mode", "group")
      .maybeSingle();
    if (!groupPkg) return { error: "Group package product not found." };
    target = {
      kind: "cohort",
      runId: cohort.id,
      courseId: cohort.course_id,
      packageId: groupPkg.id,
      label: cohort.name,
      notionPageId: cohort.notion_page_id ?? "",
    };
  } else {
    const { data: instance } = await supabase
      .from("package_instances")
      .select("id, name, course_id, package_id, notion_page_id")
      .eq("id", input.runId)
      .maybeSingle();
    if (!instance?.course_id || !instance.package_id) {
      return { error: "Package instance not found." };
    }
    target = {
      kind: "package_instance",
      runId: instance.id,
      courseId: instance.course_id,
      packageId: instance.package_id,
      label: instance.name ?? "Package instance",
      notionPageId: instance.notion_page_id ?? "",
    };
  }

  const grant = await grantResolvedTarget(supabase, row.profile_id, target);
  if (grant.error) return { error: grant.error };

  const { error } = await supabase
    .from("notion_lead_purchase_grant_queue")
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: input.resolvedBy,
      resolution_note:
        input.note ??
        `Granted ${target.kind} ${target.label} (${target.runId}).`,
    })
    .eq("id", input.queueId);

  if (error) return { error: error.message };
  return { success: `Granted ${target.label}.` };
}

export async function loadLeadPurchaseGrantQueue(
  supabase: SupabaseClient
): Promise<
  Array<{
    id: string;
    profileId: string;
    notionLeadPageId: string;
    leadEmail: string | null;
    leadName: string | null;
    reason: string;
    rawPackageData: Record<string, unknown>;
    createdAt: string;
  }>
> {
  const { data, error } = await supabase
    .from("notion_lead_purchase_grant_queue")
    .select(
      "id, profile_id, notion_lead_page_id, lead_email, lead_name, reason, raw_package_data, created_at"
    )
    .eq("resolved", false)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    if (error.message.includes("notion_lead_purchase_grant_queue")) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    profileId: row.profile_id,
    notionLeadPageId: row.notion_lead_page_id,
    leadEmail: row.lead_email,
    leadName: row.lead_name,
    reason: row.reason,
    rawPackageData: (row.raw_package_data as Record<string, unknown>) ?? {},
    createdAt: row.created_at,
  }));
}
