"use server";

import { requireAdminFromActions } from "@/app/admin/content/actions";
import { loadUnseenAppOnboarding } from "@/lib/admin/load-unseen-app-onboarding";
import type { UnseenAppOnboardingRow } from "@/lib/admin/unseen-app-onboarding-types";

export async function fetchUnseenAppOnboarding(): Promise<{
  rows: UnseenAppOnboardingRow[];
  error?: string;
}> {
  try {
    const supabase = await requireAdminFromActions();
    return loadUnseenAppOnboarding(supabase);
  } catch (error) {
    return {
      rows: [],
      error: error instanceof Error ? error.message : "Failed to load app onboarding.",
    };
  }
}
