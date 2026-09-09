"use server";

import { fetchAdminOnboardingQueue } from "@/app/admin/onboarding/actions";
import { fetchAdminRescheduleRequests } from "@/app/admin/reschedule-requests/actions";

export async function fetchCohortsHubStats(): Promise<{
  pendingReschedules: number;
  error?: string;
}> {
  const reschedule = await fetchAdminRescheduleRequests();
  const pendingReschedules = reschedule.rows.filter((row) => row.status === "pending").length;
  return {
    pendingReschedules,
    error: reschedule.error,
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
