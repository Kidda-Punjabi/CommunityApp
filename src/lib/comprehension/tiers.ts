export const COMPREHENSION_TIERS = ["short", "medium", "long"] as const;

export type ComprehensionTier = (typeof COMPREHENSION_TIERS)[number];

export const COMPREHENSION_TIER_LABELS: Record<ComprehensionTier, string> = {
  short: "Short",
  medium: "Medium",
  long: "Long",
};

export const COMPREHENSION_TIER_HINTS: Record<ComprehensionTier, string> = {
  short: "1 paragraph",
  medium: "2–3 paragraphs",
  long: "Several paragraphs (~full page)",
};

export const COMPREHENSION_DIFFICULTY_MIN = 1;
export const COMPREHENSION_DIFFICULTY_MAX = 10;
