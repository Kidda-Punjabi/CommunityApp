"use server";

import { fetchAdminCohortChangeRequests } from "@/app/admin/cohort-change-requests/actions";
import { fetchAdminOnboardingQueue } from "@/app/admin/onboarding/actions";
import { fetchAdminRescheduleRequests } from "@/app/admin/reschedule-requests/actions";

export async function fetchCohortsHubStats(): Promise<{
  pendingReschedules: number;
  pendingCohortChanges: number;
  error?: string;
}> {
  const [reschedule, cohortChange] = await Promise.all([
    fetchAdminRescheduleRequests(),
    fetchAdminCohortChangeRequests(),
  ]);
  const pendingReschedules = reschedule.rows.filter((row) => row.status === "pending").length;
  const pendingCohortChanges = cohortChange.rows.filter((row) => row.status === "pending").length;
  return {
    pendingReschedules,
    pendingCohortChanges,
    error: reschedule.error ?? cohortChange.error,
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
