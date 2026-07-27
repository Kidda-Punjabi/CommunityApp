import { isAdmin } from "@/lib/auth/admin";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import type { SupabaseClient } from "@supabase/supabase-js";
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

async function hasMasterAdminRole(
  userId: string,
  sessionClient?: SupabaseClient
): Promise<boolean> {
  if (sessionClient) {
    const { data: rows } = await sessionClient
      .from("profile_roles")
      .select("role")
      .eq("user_id", userId);

    if ((rows ?? []).some((row) => row.role === "master_admin")) {
      return true;
    }
  }

  try {
    const supabase = createServiceRoleClient();
    const { data: rows } = await supabase
      .from("profile_roles")
      .select("role")
      .eq("user_id", userId);

    return (rows ?? []).some((row) => row.role === "master_admin");
  } catch {
    return false;
  }
}

export async function isMasterAdmin(
  userId: string,
  sessionClient?: SupabaseClient
): Promise<boolean> {
  return hasMasterAdminRole(userId, sessionClient);
}

export async function canAccessAdminPanel(
  user: User | null,
  sessionClient?: SupabaseClient
): Promise<boolean> {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return hasMasterAdminRole(user.id, sessionClient);
}

export async function loadUserAppRoles(userId: string): Promise<AppRole[]> {
  const supabase = createServiceRoleClient();
  const { data: rows } = await supabase
    .from("profile_roles")
    .select("role")
    .eq("user_id", userId);

  return (rows ?? []).map((row) => row.role as AppRole);
}
