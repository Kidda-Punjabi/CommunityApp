"use server";

import { canAccessAdminPanel } from "@/lib/auth/admin-access";
import {
  loadCohortsOverview,
  type CohortsOverviewData,
} from "@/lib/admin/load-cohorts-overview";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";

export async function fetchCohortsOverview(): Promise<{
  data: CohortsOverviewData | null;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !(await canAccessAdminPanel(user, supabase))) {
      return { data: null, error: "Unauthorized." };
    }

    const service = createServiceRoleClient();
    return loadCohortsOverview(service);
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e.message : "Could not load cohorts.",
    };
  }
}
