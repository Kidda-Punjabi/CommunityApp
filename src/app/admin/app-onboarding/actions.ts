"use server";

import { requireAdminFromActions } from "@/app/admin/content/actions";
import { loadAdminAppOnboarding } from "@/lib/admin/load-admin-app-onboarding";
import type {
  AdminAppOnboardingRow,
  AdminAppOnboardingSummary,
  AppOnboardingFilter,
} from "@/lib/admin/app-onboarding/types";

const APP_ONBOARDING_PATH = "/admin/app-onboarding";

export async function fetchAdminAppOnboarding(input?: {
  page?: number;
  query?: string;
  filter?: AppOnboardingFilter;
}): Promise<{
  rows: AdminAppOnboardingRow[];
  summary: AdminAppOnboardingSummary;
  page: number;
  totalPages: number;
  hasMore: boolean;
  error?: string;
}> {
  try {
    const supabase = await requireAdminFromActions();
    return loadAdminAppOnboarding(supabase, input ?? {});
  } catch (e) {
    return {
      rows: [],
      summary: { totalCount: 0, inProgressCount: 0, completeCount: 0 },
      page: 1,
      totalPages: 1,
      hasMore: false,
      error: e instanceof Error ? e.message : "Failed to load app onboarding.",
    };
  }
}

export { APP_ONBOARDING_PATH };
