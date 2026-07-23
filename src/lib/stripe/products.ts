import { type MembershipTier } from "@/lib/membership/tiers";
import type { PaidCourseTier } from "@/lib/membership/access";

function parseIdList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function addMappings(
  target: Record<string, MembershipTier>,
  ids: string[],
  tier: MembershipTier
) {
  for (const id of ids) {
    target[id] = tier;
  }
}

export function getStripeTierMaps() {
  const productToTier: Record<string, MembershipTier> = {};
  const priceToTier: Record<string, MembershipTier> = {};

  const tiers: MembershipTier[] = ["foundational", "beginners", "community"];

  for (const tier of tiers) {
    const upper = tier.toUpperCase();
    addMappings(
      productToTier,
      parseIdList(process.env[`STRIPE_TIER_${upper}_PRODUCTS`]),
      tier
    );
    addMappings(
      priceToTier,
      parseIdList(process.env[`STRIPE_TIER_${upper}_PRICES`]),
      tier
    );
  }

  const extraMap = process.env.STRIPE_PRODUCT_TIER_MAP;
  if (extraMap) {
    try {
      const parsed = JSON.parse(extraMap) as Record<string, MembershipTier>;
      for (const [id, tier] of Object.entries(parsed)) {
        if (id.startsWith("price_")) {
          priceToTier[id] = tier;
        } else {
          productToTier[id] = tier;
        }
      }
    } catch {
      // Ignore invalid JSON; env lists are the primary source.
    }
  }

  return { productToTier, priceToTier };
}

export function tierFromStripeIds(
  productId: string | null | undefined,
  priceId: string | null | undefined
): MembershipTier | null {
  const { productToTier, priceToTier } = getStripeTierMaps();
  if (productId && productToTier[productId]) return productToTier[productId];
  if (priceId && priceToTier[priceId]) return priceToTier[priceId];
  return null;
}

export type CourseCatalogItem = {
  tier: PaidCourseTier;
  label: string;
  description: string;
  /**
   * From NEXT_PUBLIC_COURSE_URL_* or in-app `/courses/...` fallback.
   * Not currently consumed by the membership page (which uses productPath);
   * keep in sync if a future UI surfaces this field. GHL funnel URLs on
   * kidda.app (/fd, /bc, /community) must be retargeted when GHL leaves that domain.
   */
  learnMoreUrl: string | null;
};

export function getCourseCatalog(): CourseCatalogItem[] {
  const courses: Array<{
    tier: PaidCourseTier;
    label: string;
    description: string;
    envKey: string;
  }> = [
    {
      tier: "foundational",
      label: "Foundational Course",
      description: "Start with the basics — pronunciation, core vocabulary, and everyday phrases.",
      envKey: "NEXT_PUBLIC_COURSE_URL_FOUNDATIONAL",
    },
    {
      tier: "beginners",
      label: "Beginner Course",
      description: "Build confidence with guided lessons for early learners.",
      envKey: "NEXT_PUBLIC_COURSE_URL_BEGINNERS",
    },
    {
      tier: "community",
      label: "Community Course",
      description: "Join the full community experience with live sessions and advanced content.",
      envKey: "NEXT_PUBLIC_COURSE_URL_COMMUNITY",
    },
  ];

  return courses.map((course) => ({
    ...course,
    learnMoreUrl:
      process.env[course.envKey]?.trim() ||
      `/courses/${course.tier === "foundational" ? "foundational" : course.tier}`,
  }));
}
