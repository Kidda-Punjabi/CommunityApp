"use server";

import { fetchAdminOnboardingQueue } from "@/app/admin/onboarding/actions";
import { fetchAdminTutorOverview } from "@/app/admin/content/tutor-overview-actions";
import { fetchMonthlyRewardsAttention } from "@/app/admin/monthly-rewards/actions";
import { loadGroupPurchaseAttention } from "@/lib/group-purchase/load-group-purchase-attention";
import { countPendingCohortSwitchRequests } from "@/lib/admin/load-admin-cohort-switch-requests";
import { requireAdminFromActions } from "@/app/admin/content/actions";
import type { AdminOnboardingRow } from "@/lib/admin/onboarding/types";

export type AdminAttentionItem = {
  id: string;
  kind:
    | "overdue_onboarding"
    | "tutor_calendar_disconnected"
    | "monthly_rewards_pending"
    | "monthly_rewards_uncalculated"
    | "group_cohort_setup"
    | "group_cohort_placement_pending"
    | "notion_cohort_writeback"
    | "notion_lead_link"
    | "cohort_switch_pending"
    | "unmatched_kids_checkout"
    | "unmatched_webhook_grants";
  title: string;
  detail: string;
  href: string;
  urgent: boolean;
};

function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function overdueOnboardingDetail(row: AdminOnboardingRow): string {
  const paymentIso = row.paymentDate ?? row.purchasedAt.slice(0, 10);
  const paymentLabel = formatShortDate(paymentIso);

  if (!row.packageRunId) {
    return `Payment ${paymentLabel}, still unassigned`;
  }

  if (row.progressDone < row.progressTotal) {
    return `Payment ${paymentLabel}, setup incomplete`;
  }

  return `Payment ${paymentLabel}, onboarding stalled`;
}

export async function fetchAdminHomeAttention(): Promise<{
  items: AdminAttentionItem[];
  error?: string;
}> {
  const [onboarding, tutorOverview, monthlyRewards, groupPurchase, supabase] =
    await Promise.all([
      fetchAdminOnboardingQueue(),
      fetchAdminTutorOverview(),
      fetchMonthlyRewardsAttention(),
      loadGroupPurchaseAttention(),
      requireAdminFromActions(),
    ]);

  const cohortSwitchPending = await countPendingCohortSwitchRequests(supabase);

  // Check for unmatched webhook grants
  let unmatchedWebhooks = 0;
  try {
    const { findUnmatchedWebhookGrants } = await import("@/lib/stripe/verify-webhook-grant");
    const webhookEvents = await findUnmatchedWebhookGrants(supabase, {
      minAgeMinutes: 5,
      maxRetries: 10,
      limit: 100,
    });
    unmatchedWebhooks = webhookEvents.length;
  } catch (webhookError) {
    console.error("[admin attention] failed to check webhook grants:", webhookError);
  }

  const errors = [
    onboarding.error,
    tutorOverview.error,
    monthlyRewards.error,
    groupPurchase.error,
    cohortSwitchPending.error,
  ].filter(Boolean);
  const items: AdminAttentionItem[] = [];

  if (cohortSwitchPending.count > 0) {
    const label =
      cohortSwitchPending.count === 1
        ? "1 cohort change request waiting for review"
        : `${cohortSwitchPending.count} cohort change requests waiting for review`;
    items.push({
      id: "cohort-switch-pending",
      kind: "cohort_switch_pending",
      title: label,
      detail: "Approve or decline alternate group session requests",
      href: "/admin/cohort-switch-requests",
      urgent: true,
    });
  }

  if (unmatchedWebhooks > 0) {
    const label =
      unmatchedWebhooks === 1
        ? "1 payment webhook hasn't resulted in complete access grant"
        : `${unmatchedWebhooks} payment webhooks haven't resulted in complete access grants`;
    items.push({
      id: "unmatched-webhook-grants",
      kind: "unmatched_webhook_grants",
      title: label,
      detail: "Payment succeeded but user may not have signed up yet, or Notion lead missing App User ID",
      href: "/admin/webhook-grants",
      urgent: unmatchedWebhooks > 5,
    });
  }

  for (const row of groupPurchase.items) {
    items.push({
      id: row.id,
      kind: row.kind,
      title: row.title,
      detail: row.detail,
      href: row.href,
      urgent: row.urgent,
    });
  }

  for (const pending of monthlyRewards.attention.pendingMonths) {
    const cardLabel = pending.pendingCount === 1 ? "gift card" : "gift cards";
    items.push({
      id: `monthly-pending-${pending.monthStart}`,
      kind: "monthly_rewards_pending",
      title: `${pending.pendingCount} ${cardLabel} still pending for ${pending.monthLabel}`,
      detail: "Go to Monthly Rewards to mark them as sent",
      href: `/admin/monthly-rewards?month=${pending.monthStart.slice(0, 7)}`,
      urgent: true,
    });
  }

  if (monthlyRewards.attention.uncalculatedMonth) {
    const month = monthlyRewards.attention.uncalculatedMonth;
    items.push({
      id: `monthly-uncalc-${month.monthStart}`,
      kind: "monthly_rewards_uncalculated",
      title: `Calculate monthly winners for ${month.monthLabel}`,
      detail: "Previous month has ended — no winners saved yet",
      href: `/admin/monthly-rewards?month=${month.monthStart.slice(0, 7)}`,
      urgent: false,
    });
  }

  for (const row of onboarding.rows) {
    if (!row.isOverdue) continue;
    items.push({
      id: `overdue-${row.studentPackageId}`,
      kind: "overdue_onboarding",
      title: row.studentLabel,
      detail: overdueOnboardingDetail(row),
      href: `/admin/onboarding#onboarding-row-${row.studentPackageId}`,
      urgent: true,
    });
  }

  for (const tutor of tutorOverview.tutors) {
    if (tutor.connected) continue;
    items.push({
      id: `calendar-${tutor.tutorId}`,
      kind: "tutor_calendar_disconnected",
      title: tutor.displayName,
      detail: "Calendar not connected",
      href: "/admin/content/tutors",
      urgent: false,
    });
  }

  return {
    items,
    error: errors.length > 0 ? errors.join(" · ") : undefined,
  };
}
