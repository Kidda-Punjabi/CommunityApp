import type { AppRole } from "@/lib/auth/admin-access";
import { hasAnyRole } from "@/lib/auth/profile-roles";
import { loadCurrentUserAppRoles } from "@/lib/tutoring/tutor-access";
import type { SupabaseClient } from "@supabase/supabase-js";

export const FORUM_STAFF_ROLES: AppRole[] = ["tutor", "community_lead", "master_admin"];

export async function canAccessForum(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const [membershipResult, roles] = await Promise.all([
    supabase
      .from("memberships")
      .select("status")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle(),
    loadCurrentUserAppRoles(supabase, userId),
  ]);

  if (membershipResult.data) return true;
  return hasAnyRole(roles, FORUM_STAFF_ROLES);
}

export async function canModerateForum(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const roles = await loadCurrentUserAppRoles(supabase, userId);
  return hasAnyRole(roles, FORUM_STAFF_ROLES);
}

export async function loadForumGuidelinesAgreement(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("has_agreed_forum_guidelines")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data?.has_agreed_forum_guidelines ?? false;
}
