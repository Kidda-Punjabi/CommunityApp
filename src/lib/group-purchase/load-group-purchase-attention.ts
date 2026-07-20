import "server-only";

import { evaluateCohortCalendarGate } from "@/lib/group-purchase/cohort-calendar-invite";
import { loadLeadLinkAttentionItems } from "@/lib/notion/lead-sync";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";

export type GroupPurchaseAttentionItem = {
  id: string;
  kind:
    | "group_cohort_setup"
    | "group_cohort_placement_pending"
    | "notion_cohort_writeback"
    | "notion_lead_link";
  title: string;
  detail: string;
  href: string;
  urgent: boolean;
};

export async function loadGroupPurchaseAttention(): Promise<{
  items: GroupPurchaseAttentionItem[];
  error?: string;
}> {
  const supabase = createServiceRoleClient();
  const items: GroupPurchaseAttentionItem[] = [];

  const { data: pendingPackages, error: pendingError } = await supabase
    .from("student_packages")
    .select("id, user_id, course_id, purchased_at, packages(name, delivery_mode, slug)")
    .is("enrollment_id", null)
    .in("status", ["interested", "waiting_for_payment"])
    .not("last_stripe_checkout_session_id", "is", null);

  if (pendingError) {
    return { items: [], error: pendingError.message };
  }

  for (const row of pendingPackages ?? []) {
    const pkg = Array.isArray(row.packages) ? row.packages[0] : row.packages;
    if (pkg?.delivery_mode !== "group") continue;

    items.push({
      id: `group-placement-${row.id}`,
      kind: "group_cohort_placement_pending",
      title: "Paid group member needs cohort placement",
      detail: `${pkg.name ?? "Group package"} — payment received but cohort not assigned (capacity race or missing metadata).`,
      href: "/admin/onboarding",
      urgent: true,
    });
  }

  const { data: cohorts, error: cohortError } = await supabase
    .from("cohorts")
    .select("id, name, tutor_id, status")
    .in("status", ["recruiting", "scheduled", "in_progress"]);

  if (cohortError) {
    return { items, error: cohortError.message };
  }

  for (const cohort of cohorts ?? []) {
    const gate = await evaluateCohortCalendarGate(supabase, cohort.id, cohort.tutor_id);
    if (gate.ready) continue;

    const { count } = await supabase
      .from("cohort_members")
      .select("user_id", { count: "exact", head: true })
      .eq("cohort_id", cohort.id)
      .is("left_at", null);

    const memberCount = count ?? 0;
    if (memberCount === 0 && gate.reason === "no_tutor") continue;

    const reasonLabel =
      gate.reason === "no_tutor"
        ? "assign a tutor"
        : gate.reason === "no_recurring_event"
          ? "sync a recurring class to Google Calendar"
          : "connect Google Calendar";

    items.push({
      id: `group-setup-${cohort.id}`,
      kind: "group_cohort_setup",
      title: `Cohort “${cohort.name}” needs setup`,
      detail: `${memberCount} active member${memberCount === 1 ? "" : "s"} — ${reasonLabel} before calendar invites / tutor alerts can go out.`,
      href: `/admin/packages?cohort=${cohort.id}`,
      urgent: memberCount > 0,
    });
  }

  const { data: writebackRows, error: writebackError } = await supabase
    .from("notion_cohort_writeback_attention")
    .select("id, user_id, cohort_id, email, reason, lead_page_ids, created_at, cohorts(name)")
    .is("resolved_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (writebackError && !writebackError.message.includes("notion_cohort_writeback_attention")) {
    return { items, error: writebackError.message };
  }

  for (const row of writebackRows ?? []) {
    const cohort = Array.isArray(row.cohorts) ? row.cohorts[0] : row.cohorts;
    const cohortName = cohort?.name ?? "cohort";
    const reasonDetail =
      row.reason === "ambiguous_lead"
        ? `Multiple Notion lead pages match ${row.email ?? "email"} — link manually (${(row.lead_page_ids ?? []).length} pages).`
        : row.reason === "no_lead"
          ? `No Notion lead page for ${row.email ?? "this student"} — add Confirmed in Notion or link lead.`
          : row.reason === "no_notion_page"
            ? `${cohortName} is not linked to a Notion package page.`
            : `Notion Confirmed write-back failed for ${row.email ?? "student"}.`;

    items.push({
      id: `notion-writeback-${row.id}`,
      kind: "notion_cohort_writeback",
      title: `Notion Confirmed not updated (${cohortName})`,
      detail: reasonDetail,
      href: `/admin/packages?cohort=${row.cohort_id}`,
      urgent: true,
    });
  }

  try {
    const leadLinkRows = await loadLeadLinkAttentionItems(supabase);
    for (const row of leadLinkRows) {
      items.push({
        id: `notion-lead-link-${row.id}`,
        kind: "notion_lead_link",
        title: "Ambiguous Notion lead match",
        detail: `${row.email ?? "Profile"} matches ${row.leadPageIds.length} lead pages — pick one in Notion and set App User ID.`,
        href: "/admin/onboarding",
        urgent: true,
      });
    }
  } catch (leadLinkError) {
    return {
      items,
      error: leadLinkError instanceof Error ? leadLinkError.message : "Lead link attention failed.",
    };
  }

  return { items };
}
