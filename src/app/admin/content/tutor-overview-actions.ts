"use server";

import { requireAdminFromActions } from "@/app/admin/content/actions";
import {
  loadAdminTutorOverview,
  type AdminTutorOverviewRow,
} from "@/lib/admin/load-admin-tutor-overview";

export async function fetchAdminTutorOverview(): Promise<{
  tutors: AdminTutorOverviewRow[];
  error?: string;
}> {
  try {
    const supabase = await requireAdminFromActions();
    return await loadAdminTutorOverview(supabase);
  } catch (e) {
    return {
      tutors: [],
      error: e instanceof Error ? e.message : "Failed to load tutor overview.",
    };
  }
}
