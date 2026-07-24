/**
 * App subscription tier on profiles.membership_tier (Postgres enum).
 * Live values: free | basic | premium.
 * Do not confuse with PaidCourseTier (foundational/beginners/community via course_access).
 * Do not repurpose `basic` without a product decision.
 */
export const PROFILE_MEMBERSHIP_TIERS = ["free", "basic", "premium"] as const;

export type ProfileMembershipTier = (typeof PROFILE_MEMBERSHIP_TIERS)[number];

export const ACTIVE_SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
] as const;

export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "past_due"
  | "incomplete"
  | "trialing"
  | "unpaid";

export function normalizeProfileMembershipTier(
  value: string | null | undefined
): ProfileMembershipTier {
  const tier = (value ?? "free").toLowerCase();
  if (tier === "premium" || tier === "basic") return tier;
  return "free";
}

export function isPremiumProfileTier(
  value: string | null | undefined
): boolean {
  return normalizeProfileMembershipTier(value) === "premium";
}
