import type { AppRole } from "@/lib/auth/admin-access";
import { hasAnyRole } from "@/lib/auth/profile-roles";
import type { SupabaseClient } from "@supabase/supabase-js";

const TUTOR_DASHBOARD_ROLES: AppRole[] = ["tutor", "master_admin"];

export async function loadCurrentUserAppRoles(
  supabase: SupabaseClient,
  userId: string
): Promise<AppRole[]> {
  const { data, error } = await supabase
    .from("profile_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) throw error;
  return (data ?? []).map((row) => row.role as AppRole);
}

export async function canAccessTutorDashboard(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const roles = await loadCurrentUserAppRoles(supabase, userId);
  return hasAnyRole(roles, TUTOR_DASHBOARD_ROLES);
}
