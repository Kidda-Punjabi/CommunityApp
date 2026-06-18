import type { PaidCourseTier } from "./access";

export const VIEW_AS_COOKIE = "kidda_view_as_tiers";

export const VIEW_AS_TIER_OPTIONS: {
  tier: PaidCourseTier;
  label: string;
}[] = [
  { tier: "foundational", label: "Foundational" },
  { tier: "beginners", label: "Beginners" },
  { tier: "community", label: "Community" },
];

export type ViewAsState =
  | { mode: "real" }
  | { mode: "override"; tiers: PaidCourseTier[] };

export function parseViewAsCookie(value: string | undefined): ViewAsState {
  if (!value) return { mode: "real" };

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return { mode: "real" };

    const tiers = parsed.filter(
      (tier): tier is PaidCourseTier =>
        tier === "foundational" || tier === "beginners" || tier === "community"
    );

    return { mode: "override", tiers };
  } catch {
    return { mode: "real" };
  }
}

export function formatViewAsLabel(tiers: PaidCourseTier[]): string {
  if (tiers.length === 0) return "Free only";

  return VIEW_AS_TIER_OPTIONS.filter((option) => tiers.includes(option.tier))
    .map((option) => option.label)
    .join(", ");
}
