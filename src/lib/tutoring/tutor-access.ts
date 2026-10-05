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

/** Assigned tutor, or a master admin opening someone else's class. */
export async function canEditTeachingClass(
  supabase: SupabaseClient,
  userId: string,
  assignedTutorId: string | null
): Promise<boolean> {
  if (assignedTutorId && assignedTutorId === userId) return true;
  const roles = await loadCurrentUserAppRoles(supabase, userId);
  if (roles.includes("master_admin")) return true;
  const { data } = await supabase.auth.getUser();
  return data.user?.id === userId && data.user.app_metadata?.role === "admin";
}

export async function canManageCohort(
  supabase: SupabaseClient,
  userId: string,
  cohortId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("tutor_can_manage_cohort", {
    p_cohort_id: cohortId,
  });
  if (!error) return Boolean(data);

  console.error("[tutor-access] tutor_can_manage_cohort rpc failed", {
    message: error.message,
    cohortId,
    userId,
  });

  // Fallback if the RPC is unavailable — assigned tutor / enrollment only.
  const roles = await loadCurrentUserAppRoles(supabase, userId);
  if (roles.includes("master_admin")) return true;

  const { data: cohort } = await supabase
    .from("cohorts")
    .select("tutor_id")
    .eq("id", cohortId)
    .maybeSingle();

  if (cohort?.tutor_id === userId) return true;

  const { data: enrollments } = await supabase
    .from("course_enrollments")
    .select("id")
    .eq("tutor_id", userId)
    .eq("cohort_id", cohortId)
    .limit(1);

  return (enrollments?.length ?? 0) > 0;
}
