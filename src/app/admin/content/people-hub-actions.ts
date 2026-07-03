"use server";

import { fetchCohortsOverview } from "@/app/admin/content/cohort-overview-actions";
import { loadAdminStudentDiscountRequests } from "@/app/admin/content/student-discount-actions";

export type PeopleHubStats = {
  cohorts: string;
  members: string;
  payments: string;
  discounts: string;
  staff: string;
};

export async function fetchPeopleHubStats(
  membersEnrolled: number,
  staffCount: number
): Promise<{ stats: PeopleHubStats; error?: string }> {
  const [cohortsResult, discountsResult] = await Promise.all([
    fetchCohortsOverview(),
    loadAdminStudentDiscountRequests(),
  ]);

  const errors = [cohortsResult.error, discountsResult.error].filter(Boolean);

  const activeCohorts = cohortsResult.data?.stats.activeCohorts ?? 0;
  const allocated = cohortsResult.data?.stats.totalAllocated ?? 0;

  const pendingDiscounts = discountsResult.requests.filter((r) => r.status === "pending").length;
  const reviewedDiscounts = discountsResult.requests.filter(
    (r) => r.status === "approved" || r.status === "rejected"
  ).length;

  return {
    stats: {
      cohorts: `${activeCohorts} active · ${allocated} allocated`,
      members: `${membersEnrolled} enrolled`,
      payments: "Stripe checkout sessions",
      discounts: `${pendingDiscounts} pending · ${reviewedDiscounts} reviewed`,
      staff: `${staffCount} staff`,
    },
    error: errors.length > 0 ? errors.join(" · ") : undefined,
  };
}
