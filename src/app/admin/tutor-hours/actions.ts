"use server";

import { isMasterAdmin } from "@/lib/auth/admin-access";
import {
  loadAdminTutorHours,
  type TutorHoursWeekResult,
} from "@/lib/admin/load-admin-tutor-hours";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";

async function requireMasterAdmin() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user || !(await isMasterAdmin(user.id, authClient))) {
    throw new Error("Unauthorized");
  }

  return createServiceRoleClient();
}

export async function fetchAdminTutorHours(
  weekStart?: string | null
): Promise<TutorHoursWeekResult> {
  try {
    const supabase = await requireMasterAdmin();
    return await loadAdminTutorHours(supabase, weekStart);
  } catch (e) {
    return {
      weekStart: weekStart ?? "",
      weekEnd: "",
      isPastWeek: false,
      historicalNote: null,
      tutors: [],
      error: e instanceof Error ? e.message : "Failed to load tutor hours.",
    };
  }
}
