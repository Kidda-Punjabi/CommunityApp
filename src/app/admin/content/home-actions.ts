"use server";

import { fetchAdminOnboardingQueue } from "@/app/admin/onboarding/actions";
import { fetchMonthlyRewardsAttention } from "@/app/admin/monthly-rewards/actions";
import { loadGroupPurchaseAttention } from "@/lib/group-purchase/load-group-purchase-attention";
import { countPendingCohortSwitchRequests } from "@/lib/admin/load-admin-cohort-switch-requests";
import { requireAdminFromActions } from "@/app/admin/content/actions";

export type AdminAttentionCategory = {
  id:
    | "cohort_switch"
    | "enrollment_gaps"
    | "cohorts_setup"
    | "payment_setup"
    | "monthly_rewards";
  title: string;
  description: string;
  href: string;
  count: number;
  tone: "neutral" | "warning" | "urgent";
};

function toneForCount(
  count: number,
  attention: "warning" | "urgent"
): "neutral" | "warning" | "urgent" {
  return count > 0 ? attention : "neutral";
}

export async function fetchAdminHomeAttention(): Promise<{
  categories: AdminAttentionCategory[];
  error?: string;
}> {
  const [onboarding, monthlyRewards, groupPurchase, supabase] = await Promise.all([
    fetchAdminOnboardingQueue(),
    fetchMonthlyRewardsAttention(),
    loadGroupPurchaseAttention(),
    requireAdminFromActions(),
  ]);

  const cohortSwitchPending = await countPendingCohortSwitchRequests(supabase);

  const errors = [
    onboarding.error,
    monthlyRewards.error,
    groupPurchase.error,
    cohortSwitchPending.error,
  ].filter(Boolean);

  const enrollmentGaps = groupPurchase.items.filter(
    (item) =>
      item.kind === "group_cohort_placement_pending" ||
      item.kind === "unmatched_kids_checkout"
  ).length;

  const cohortsNeedingSetup = groupPurchase.items.filter(
    (item) => item.kind === "group_cohort_setup"
  ).length;

  const paymentSetupIncomplete = onboarding.rows.filter((row) => {
    if (!row.isOverdue) return false;
    return !row.packageRunId || row.progressDone < row.progressTotal;
  }).length;

  const categories: AdminAttentionCategory[] = [
    {
      id: "cohort_switch",
      title: "Cohort switch requests",
      description: "Pending requests to join an alternate group session",
      href: "/admin/cohort-switch-requests",
      count: cohortSwitchPending.count,
      tone: toneForCount(cohortSwitchPending.count, "urgent"),
    },
    {
      id: "enrollment_gaps",
      title: "Enrollment gaps",
      description: "Paid group members with no cohort, plus queued kids purchases",
      href: "/admin/onboarding",
      count: enrollmentGaps,
      tone: toneForCount(enrollmentGaps, "urgent"),
    },
    {
      id: "cohorts_setup",
      title: "Cohorts needing setup",
      description: "Cohorts with no calendar sync",
      href: "/admin/packages",
      count: cohortsNeedingSetup,
      tone: toneForCount(cohortsNeedingSetup, "warning"),
    },
    {
      id: "payment_setup",
      title: "Payment setup incomplete",
      description: "Setup incomplete or still unassigned",
      href: "/admin/onboarding",
      count: paymentSetupIncomplete,
      tone: toneForCount(paymentSetupIncomplete, "warning"),
    },
  ];

  if (monthlyRewards.attention.uncalculatedMonth) {
    const month = monthlyRewards.attention.uncalculatedMonth;
    categories.push({
      id: "monthly_rewards",
      title: "Monthly rewards",
      description: `Winners not calculated for ${month.monthLabel}`,
      href: `/admin/monthly-rewards?month=${month.monthStart.slice(0, 7)}`,
      count: 1,
      tone: "warning",
    });
  }

  return {
    categories,
    error: errors.length > 0 ? errors.join(" · ") : undefined,
  };
}
