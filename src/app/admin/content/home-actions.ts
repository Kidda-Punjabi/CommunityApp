"use server";

import { requireAdminFromActions } from "@/app/admin/content/actions";
import { loadAdminDashboard } from "@/lib/admin/dashboard/load-admin-dashboard";
import type { AdminDashboardSnapshot } from "@/lib/admin/dashboard/types";

export type { AdminDashboardCard, AdminDashboardSnapshot } from "@/lib/admin/dashboard/types";

export async function fetchAdminDashboard(): Promise<AdminDashboardSnapshot> {
  try {
    const supabase = await requireAdminFromActions();
    return loadAdminDashboard(supabase);
  } catch (e) {
    return {
      cards: [],
      error: e instanceof Error ? e.message : "Failed to load dashboard.",
    };
  }
}
