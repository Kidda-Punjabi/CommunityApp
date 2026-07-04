import type { ComprehensionTier } from "./tiers";

export const COMPREHENSION_TIER_LEARNER_DESCRIPTIONS: Record<ComprehensionTier, string> = {
  short: "One paragraph · beginner-friendly",
  medium: "2–3 paragraphs · builds stamina",
  long: "Full-page passages · advanced",
};

export const COMPREHENSION_TIER_ICONS: Record<ComprehensionTier, string> = {
  short: "📄",
  medium: "📑",
  long: "📚",
};
