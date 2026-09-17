"use server";

import { fetchAdminCohortChangeRequests } from "@/app/admin/cohort-change-requests/actions";
import { fetchPendingCohortSwitchCount } from "@/app/admin/cohort-switch-requests/actions";
import { fetchAdminOnboardingQueue } from "@/app/admin/onboarding/actions";
import { fetchAdminRescheduleRequests } from "@/app/admin/reschedule-requests/actions";

export async function fetchCohortsHubStats(): Promise<{
  pendingReschedules: number;
  pendingCohortChanges: number;
  pendingGroupReschedules: number;
  error?: string;
}> {
  const [reschedule, cohortChange, groupReschedule] = await Promise.all([
    fetchAdminRescheduleRequests(),
    fetchAdminCohortChangeRequests(),
    fetchPendingCohortSwitchCount(),
  ]);
  const pendingReschedules = reschedule.rows.filter((row) => row.status === "pending").length;
  const pendingCohortChanges = cohortChange.rows.filter((row) => row.status === "pending").length;
  return {
    pendingReschedules,
    pendingCohortChanges,
    pendingGroupReschedules: groupReschedule.count,
    error: reschedule.error ?? cohortChange.error ?? groupReschedule.error,
  };
}

export async function fetchPaymentsHubStats(): Promise<{
  overdueCount: number;
  error?: string;
}> {
  const onboarding = await fetchAdminOnboardingQueue();
  return {
    overdueCount: onboarding.summary.overdueCount,
    error: onboarding.error,
  };
}
