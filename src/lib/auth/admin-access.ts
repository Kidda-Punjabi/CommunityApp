import { isAdmin } from "@/lib/auth/admin";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import type { User } from "@supabase/supabase-js";

export type AppRole = "member" | "tutor" | "community_lead" | "master_admin";

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  member: "Member",
  tutor: "Tutor",
  community_lead: "Community lead",
  master_admin: "Master admin",
};

/** Roles that can be assigned to students as tutors / cohort leads. */
export const ASSIGNABLE_STAFF_ROLES: AppRole[] = [
  "tutor",
  "community_lead",
  "master_admin",
];

export async function canAccessAdminPanel(user: User | null): Promise<boolean> {
  if (!user) return false;
  if (isAdmin(user)) return true;

  try {
    const supabase = createServiceRoleClient();
    const { data: rows } = await supabase
      .from("profile_roles")
      .select("role")
      .eq("user_id", user.id);

    return (rows ?? []).some((row) => row.role === "master_admin");
  } catch {
    return false;
  }
}

export async function loadUserAppRoles(userId: string): Promise<AppRole[]> {
  const supabase = createServiceRoleClient();
  const { data: rows } = await supabase
    .from("profile_roles")
    .select("role")
    .eq("user_id", userId);

  return (rows ?? []).map((row) => row.role as AppRole);
}
