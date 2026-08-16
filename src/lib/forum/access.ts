import type { AppRole } from "@/lib/auth/admin-access";
import { hasAnyRole } from "@/lib/auth/profile-roles";
import { resolveCourseActor } from "@/lib/kids/course-actor";
import { loadCurrentUserAppRoles } from "@/lib/tutoring/tutor-access";
import type { SupabaseClient } from "@supabase/supabase-js";

export const FORUM_INTRO_CATEGORY = "Introduction";

export const FORUM_STAFF_ROLES: AppRole[] = ["tutor", "community_lead", "master_admin"];

export async function canAccessForum(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const actor = await resolveCourseActor(supabase, userId);
  if (actor.kind === "kid") return false;

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
  const state = await loadForumOnboardingState(supabase, userId);
  return state.hasAgreedGuidelines;
}

export type ForumOnboardingState = {
  hasAgreedGuidelines: boolean;
  hasCompletedIntro: boolean;
};

export async function loadForumOnboardingState(
  supabase: SupabaseClient,
  userId: string
): Promise<ForumOnboardingState> {
  const { data, error } = await supabase
    .from("profiles")
    .select("has_agreed_forum_guidelines, has_completed_community_intro")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;

  return {
    hasAgreedGuidelines: data?.has_agreed_forum_guidelines ?? false,
    hasCompletedIntro: data?.has_completed_community_intro ?? false,
  };
}

export function forumComposerPath(state: ForumOnboardingState): string {
  if (!state.hasAgreedGuidelines) return "/dashboard/community/forum/guidelines";
  if (!state.hasCompletedIntro) return "/dashboard/community/forum/intro";
  return "/dashboard/community/forum/new";
}
