import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  isPremiumProfileTier,
  type ProfileMembershipTier,
  type SubscriptionStatus,
} from "@/lib/membership/profile-tier";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PremiumAccessSnapshot = {
  isPremium: boolean;
  profileTier: ProfileMembershipTier;
  subscriptionStatus: SubscriptionStatus | null;
  stripeSubscriptionId: string | null;
};

/**
 * Premium entitlement: active/trialing memberships row OR denormalized
 * profiles.membership_tier = 'premium'. Does not grant course_access.
 */
export async function loadPremiumAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<PremiumAccessSnapshot> {
  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase
      .from("profiles")
      .select("membership_tier")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("memberships")
      .select("status, stripe_subscription_id, tier_name")
      .eq("user_id", userId)
      .in("status", [...ACTIVE_SUBSCRIPTION_STATUSES])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const profileTier = (profile?.membership_tier as ProfileMembershipTier | undefined) ?? "free";
  const subscriptionStatus = (membership?.status as SubscriptionStatus | undefined) ?? null;
  const fromMembership = Boolean(membership);
  const fromProfile = isPremiumProfileTier(profileTier);

  return {
    isPremium: fromMembership || fromProfile,
    profileTier: fromMembership ? "premium" : profileTier === "basic" ? "basic" : fromProfile ? "premium" : "free",
    subscriptionStatus,
    stripeSubscriptionId: membership?.stripe_subscription_id ?? null,
  };
}

export async function hasPremiumAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const access = await loadPremiumAccess(supabase, userId);
  return access.isPremium;
}

/** Parent Premium check for Kids Mode (via kid_profiles.parent_user_id). */
export async function parentHasPremiumAccess(
  supabase: SupabaseClient,
  parentUserId: string
): Promise<boolean> {
  return hasPremiumAccess(supabase, parentUserId);
}

export async function setProfileMembershipTier(
  userId: string,
  tier: ProfileMembershipTier
): Promise<void> {
  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("profiles")
    .update({
      membership_tier: tier,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw error;
}
