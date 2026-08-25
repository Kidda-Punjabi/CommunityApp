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
 * - 0 Packages → logged skip (normal unpaid signup); no queue noise
 * - Exactly one cleanly resolved package → auto-grant
 * - Multiple / unresolvable → queue for admin
 */
export async function grantAccessFromLinkedLeadPackages(
  supabase: SupabaseClient,
  profileId: string,
  leadPageId: string
): Promise<LeadPurchaseGrantResult> {
  const startTime = Date.now();
  const requestId = `${profileId.slice(0, 8)}-${startTime}`;
  
  const result: LeadPurchaseGrantResult = {
    attempted: true,
    granted: 0,
    queued: 0,
    skipped: 0,
    errors: [],
    details: [],
  };

  console.info(
    `[lead purchase grant] begin requestId=${requestId} profile=${profileId} lead=${leadPageId}`
  );

  let leadProperties: Record<string, unknown>;
  try {
    const page = await notionJson<{ properties: Record<string, unknown> }>(
      `/pages/${leadPageId}`
    );
    leadProperties = page.properties ?? {};
    console.info(
      `[lead purchase grant] notion fetched requestId=${requestId} elapsed=${Date.now() - startTime}ms`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notion lead fetch failed.";
    const stack = error instanceof Error ? error.stack : undefined;
    console.error(
      `[lead purchase grant] Notion fetch failed requestId=${requestId} profile=${profileId} lead=${leadPageId} elapsed=${Date.now() - startTime}ms:`,
      message,
      stack?.slice(0, 300)
    );
    result.errors.push(message);
    const queued = await enqueueLeadPurchaseGrant(supabase, {
      profileId,
      notionLeadPageId: leadPageId,
      leadEmail: null,
      leadName: null,
      reason: "notion_fetch_failed",
      rawPackageData: { 
        error: message, 
        stack: stack?.slice(0, 500),
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
    if (queued.queued) result.queued = 1;
    if (queued.error) {
      result.errors.push(queued.error);
      console.error(
        `[lead purchase grant] CRITICAL queue insert failed requestId=${requestId}:`,
        queued.error
      );
    }
    console.error(
      `[lead purchase grant] outcome requestId=${requestId} profile=${profileId} lead=${leadPageId}`,
      result
    );
    return result;
  }

  const leadEmail = leadEmailFromPage(leadProperties);
  const leadName = leadNameFromPage(leadProperties);
  const packagePageIds = relationIds(
    leadProperties.Packages as { relation?: Array<{ id?: string }> } | undefined
  );

  console.info(
    `[lead purchase grant] parsed requestId=${requestId} packages=${packagePageIds.length} email=${leadEmail ?? "null"}`
  );

  if (packagePageIds.length === 0) {
    result.skipped = 1;
    result.details.push("No Packages relation — nothing to grant.");
    console.info(
      `[lead purchase grant] no-packages requestId=${requestId} profile=${profileId} lead=${leadPageId} email=${leadEmail ?? "?"} elapsed=${Date.now() - startTime}ms`
    );
    return result;
  }

  const resolved: ResolvedPackageTarget[] = [];
  const unresolved: Array<{ notionPageId: string; error: string }> = [];

  for (const packagePageId of packagePageIds) {
    const match = await resolveNotionPackagePage(supabase, packagePageId);
    if ("kind" in match) {
      resolved.push(match);
      console.info(
        `[lead purchase grant] resolved requestId=${requestId} package=${packagePageId} kind=${match.kind} run=${match.runId}`
      );
    } else {
      unresolved.push({ notionPageId: match.notionPageId, error: match.error });
      console.warn(
        `[lead purchase grant] unresolved requestId=${requestId} package=${packagePageId} error=${match.error}`
      );
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
    requestId,
    timestamp: new Date().toISOString(),
  };

  const isCleanSingle =
    resolved.length === 1 && unresolved.length === 0 && packagePageIds.length === 1;

  if (!isCleanSingle) {
    const reason =
      packagePageIds.length > 1
        ? "ambiguous_multiple_packages"
        : unresolved.length > 0
          ? "unresolvable_package"
          : "ambiguous_package_match";

    console.warn(
      `[lead purchase grant] ${reason} requestId=${requestId} profile=${profileId} resolved=${resolved.length} unresolved=${unresolved.length} elapsed=${Date.now() - startTime}ms`
    );

    const queued = await enqueueLeadPurchaseGrant(supabase, {
      profileId,
      notionLeadPageId: leadPageId,
      leadEmail,
      leadName,
      reason,
      rawPackageData,
    });
    if (queued.error) {
      result.errors.push(queued.error);
      console.error(
        `[lead purchase grant] CRITICAL queue insert failed requestId=${requestId} reason=${reason}:`,
        queued.error
      );
    }
    if (queued.queued) {
      result.queued = 1;
      result.details.push(`Queued (${reason}).`);
    } else {
      result.details.push(`Could not queue (${reason}).`);
    }
    console.warn(
      `[lead purchase grant] ${reason} requestId=${requestId} profile=${profileId} lead=${leadPageId}`,
      rawPackageData,
      result
    );
    return result;
  }

  const target = resolved[0]!;
  console.info(
    `[lead purchase grant] granting requestId=${requestId} target=${target.kind}:${target.runId} (${target.label})`
  );
  
  const grant = await grantResolvedTarget(supabase, profileId, target);
  if (grant.error) {
    result.errors.push(grant.error);
    console.error(
      `[lead purchase grant] grant_failed requestId=${requestId} profile=${profileId} target=${target.label} elapsed=${Date.now() - startTime}ms:`,
      grant.error
    );
    
    const queued = await enqueueLeadPurchaseGrant(supabase, {
      profileId,
      notionLeadPageId: leadPageId,
      leadEmail,
      leadName,
      reason: "grant_failed",
      rawPackageData: { 
        ...rawPackageData, 
        grantError: grant.error,
        targetKind: target.kind,
        targetRunId: target.runId,
      },
    });
    if (queued.queued) result.queued = 1;
    if (queued.error) {
      result.errors.push(queued.error);
      console.error(
        `[lead purchase grant] CRITICAL queue insert failed after grant_failed requestId=${requestId}:`,
        queued.error
      );
    }
    return result;
  }

  result.granted = 1;
  result.details.push(`Granted ${target.kind} ${target.label} (${target.runId}).`);
  console.info(
    `[lead purchase grant] SUCCESS requestId=${requestId} profile=${profileId} lead=${leadPageId} ${target.kind}=${target.runId} label=${target.label} elapsed=${Date.now() - startTime}ms`
  );
  return result;
}

/** Best-effort follow-up after linkLeadsForProfile — never throws. */
export async function maybeGrantAccessAfterLeadLink(
  supabase: SupabaseClient,
  profileId: string,
  linkResult: Pick<LinkLeadsForProfileResult, "leadPageId" | "ambiguous" | "conflicts">
): Promise<LeadPurchaseGrantResult | null> {
  const requestId = `${profileId.slice(0, 8)}-${Date.now()}`;
  console.info(
    `[lead purchase grant] start requestId=${requestId} profile=${profileId} lead=${linkResult.leadPageId ?? "none"}`
  );

  if (!linkResult.leadPageId) {
    console.info(
      `[lead purchase grant] skip requestId=${requestId} — no lead linked profile=${profileId} ambiguous=${linkResult.ambiguous} conflicts=${linkResult.conflicts}`
    );
    return null;
  }
  // Ambiguous lead match did not produce a trustworthy single lead page.
  if (linkResult.ambiguous > 0) {
    console.warn(
      `[lead purchase grant] skip requestId=${requestId} — ambiguous lead match profile=${profileId} lead=${linkResult.leadPageId}`
    );
    return null;
  }

  try {
    const result = await grantAccessFromLinkedLeadPackages(
      supabase,
      profileId,
      linkResult.leadPageId
    );

    // CRITICAL FIX: If grant was attempted but failed (errors present and not granted),
    // ensure it's queued. This catches cases where the queue insert inside
    // grantAccessFromLinkedLeadPackages might have failed silently.
    if (result.attempted && result.granted === 0 && result.queued === 0 && result.errors.length > 0) {
      console.error(
        `[lead purchase grant] grant failed but not queued requestId=${requestId} profile=${profileId} lead=${linkResult.leadPageId} errors=${JSON.stringify(result.errors)}`
      );
      try {
        const queueResult = await enqueueLeadPurchaseGrant(supabase, {
          profileId,
          notionLeadPageId: linkResult.leadPageId,
          leadEmail: null,
          leadName: null,
          reason: "grant_failed_retry",
          rawPackageData: { 
            originalErrors: result.errors,
            requestId,
            timestamp: new Date().toISOString(),
          },
        });
        if (queueResult.queued) {
          result.queued = 1;
          result.details.push("Queued after detecting failed grant.");
        }
      } catch (retryQueueError) {
        console.error(
          `[lead purchase grant] retry queue failed requestId=${requestId} profile=${profileId}:`,
          retryQueueError instanceof Error ? retryQueueError.message : retryQueueError
        );
      }
    }

    // Update any pending webhook events for this profile/email
    // This links signup-triggered grants back to the original payment webhook
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", profileId)
        .maybeSingle();

      if (profile?.email) {
        const { logStripeWebhookGrantAttempt } = await import("@/lib/stripe/webhook-event-log");
        await logStripeWebhookGrantAttempt({
          eventId: "", // Will match by email
          email: profile.email,
          profileId,
          status: result.granted > 0 ? "completed" : result.queued > 0 ? "needs_retry" : "failed",
          error: result.errors.length > 0 ? result.errors.join("; ") : undefined,
        });

        // Also try to retry any other pending webhooks for this email
        // This handles the "payment before signup" case
        const { retryWebhookGrantsForProfile } = await import("@/lib/stripe/retry-webhook-grants");
        await retryWebhookGrantsForProfile(supabase, profileId, profile.email);
      }
    } catch (webhookUpdateError) {
      // Don't fail the grant if webhook update fails
      console.error(
        `[lead purchase grant] failed to update webhook status requestId=${requestId}:`,
        webhookUpdateError instanceof Error ? webhookUpdateError.message : webhookUpdateError
      );
    }

    console.info(
      `[lead purchase grant] complete requestId=${requestId} profile=${profileId} granted=${result.granted} queued=${result.queued} errors=${result.errors.length}`
    );
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Purchase grant failed.";
    const stack = error instanceof Error ? error.stack : undefined;
    console.error(
      `[lead purchase grant] unexpected failure requestId=${requestId} profile=${profileId} lead=${linkResult.leadPageId}:`,
      message,
      stack
    );
    try {
      await enqueueLeadPurchaseGrant(supabase, {
        profileId,
        notionLeadPageId: linkResult.leadPageId,
        leadEmail: null,
        leadName: null,
        reason: "unexpected_failure",
        rawPackageData: { 
          error: message, 
          stack: stack?.slice(0, 500),
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (queueError) {
      console.error(
        `[lead purchase grant] failed to queue unexpected_failure requestId=${requestId} profile=${profileId}:`,
        queueError instanceof Error ? queueError.message : queueError
      );
    }
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

/**
 * Heal path for already-linked profiles (e.g. password login). Signup/auth-callback
 * own the primary trigger; this covers cases where grant never ran after linking.
 * Skips the Notion round-trip when the profile already has a confirmed package or
 * active cohort membership (idempotent fast path).
 */
export async function maybeGrantAccessForLinkedProfile(
  supabase: SupabaseClient,
  profileId: string
): Promise<LeadPurchaseGrantResult | null> {
  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("notion_lead_page_id")
      .eq("id", profileId)
      .maybeSingle();
    if (error) {
      console.error(
        `[lead purchase grant] linked-profile heal load failed profile=${profileId}:`,
        error.message
      );
      return null;
    }
    const leadPageId = profile?.notion_lead_page_id?.trim();
    if (!leadPageId) {
      console.info(
        `[lead purchase grant] linked-profile heal skip — no notion_lead_page_id profile=${profileId}`
      );
      return null;
    }

    const [{ count: memberCount }, { count: packageCount }] = await Promise.all([
      supabase
        .from("cohort_members")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profileId)
        .is("left_at", null),
      supabase
        .from("student_packages")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profileId)
        .eq("status", "confirmed"),
    ]);

    if ((memberCount ?? 0) > 0 || (packageCount ?? 0) > 0) {
      console.info(
        `[lead purchase grant] linked-profile heal skip — already has access profile=${profileId} members=${memberCount ?? 0} packages=${packageCount ?? 0}`
      );
      return {
        attempted: false,
        granted: 0,
        queued: 0,
        skipped: 1,
        errors: [],
        details: ["Already has cohort membership or confirmed package."],
      };
    }

    console.info(
      `[lead purchase grant] linked-profile heal running profile=${profileId} lead=${leadPageId}`
    );
    return await grantAccessFromLinkedLeadPackages(supabase, profileId, leadPageId);
  } catch (error) {
    console.error(
      `[lead purchase grant] linked-profile heal unexpected profile=${profileId}:`,
      error instanceof Error ? error.message : error
    );
    return null;
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
