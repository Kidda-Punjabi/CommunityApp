export const MEMBERSHIP_TIERS = [
  "free",
  "foundational",
  "beginners",
  "community",
] as const;

export type MembershipTier = (typeof MEMBERSHIP_TIERS)[number];

export const TIER_RANK: Record<MembershipTier, number> = {
  free: 0,
  foundational: 1,
  beginners: 2,
  community: 3,
};

export const TIER_LABELS: Record<MembershipTier, string> = {
  free: "Free",
  foundational: "Foundational Course",
  beginners: "Beginner Course",
  community: "Kidda Community",
};

/**
 * Private / unlisted courses use required_tier = "private".
 * They are never Foundational / Beginners / Community products — access is
 * via course_access only, not membership_tier mapping.
 */
export function isPrivateCourseTier(value: string | null | undefined): boolean {
  return (value ?? "").toLowerCase() === "private";
}

export function normalizeTier(value: string | null | undefined): MembershipTier {
  const tier = (value ?? "free").toLowerCase();
  if (isPrivateCourseTier(tier)) {
    // Do not fall through to "community" (legacy paid catch-all).
    return "free";
  }
  if (tier === "foundational" || tier === "beginners" || tier === "community") {
    return tier;
  }
  if (tier !== "free") {
    // Legacy paid values from before tiered products
    return "community";
  }
  return "free";
}

export function inferCourseTier(courseName: string): MembershipTier {
  const name = courseName.toLowerCase();
  if (name.includes("community")) return "community";
  if (name.includes("beginner")) return "beginners";
  if (name.includes("foundational")) return "foundational";
  return "foundational";
}

/** @deprecated Use per-course access via profile_course_access instead. */
export function tierMeetsRequirement(
  userTier: string | null | undefined,
  requiredTier: string | null | undefined
): boolean {
  return normalizeTier(userTier) === normalizeTier(requiredTier ?? "foundational");
}
