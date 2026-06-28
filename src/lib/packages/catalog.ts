import type { LearnTrackId } from "@/lib/learning/learn-catalog";
import type { PaidCourseTier } from "@/lib/membership/access";

export type PackageDeliveryMode = "one_to_one" | "group" | null;

export type PackageCatalogEntry = {
  slug: string;
  name: string;
  learnTrackId: LearnTrackId;
  tier: PaidCourseTier;
  deliveryMode: PackageDeliveryMode;
  includesLiveSessions: boolean;
  description: string;
};

/** Sellable packages — maps to courses + delivery format in the business. */
export const PACKAGE_CATALOG: PackageCatalogEntry[] = [
  {
    slug: "foundational",
    name: "Foundational Course",
    learnTrackId: "foundational",
    tier: "foundational",
    deliveryMode: null,
    includesLiveSessions: true,
    description: "1-1 live tutoring with pronunciation, core vocabulary, and everyday phrases.",
  },
  {
    slug: "beginners-1-1",
    name: "Beginners Course (1-1)",
    learnTrackId: "beginners",
    tier: "beginners",
    deliveryMode: "one_to_one",
    includesLiveSessions: true,
    description: "Private Beginners lessons with your assigned tutor.",
  },
  {
    slug: "beginners-group",
    name: "Beginners Course (Group)",
    learnTrackId: "beginners",
    tier: "beginners",
    deliveryMode: "group",
    includesLiveSessions: true,
    description: "Small-group Punjabi lessons on a fixed weekly schedule.",
  },
  {
    slug: "community",
    name: "Kidda Community",
    learnTrackId: "community",
    tier: "community",
    deliveryMode: null,
    includesLiveSessions: false,
    description: "24 weeks of community content and live sessions.",
  },
];

export function getPackageCatalogEntry(slug: string): PackageCatalogEntry | undefined {
  return PACKAGE_CATALOG.find((entry) => entry.slug === slug);
}

export function packageSlugForEnrollment(
  tier: PaidCourseTier,
  deliveryMode: PackageDeliveryMode
): string {
  if (tier === "foundational") return "foundational";
  if (tier === "community") return "community";
  if (deliveryMode === "group") return "beginners-group";
  if (deliveryMode === "one_to_one") return "beginners-1-1";
  return "beginners-1-1";
}
