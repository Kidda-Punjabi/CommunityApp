/** Display name — change here to rename the game everywhere in UI. */
export const KIHDA_DISPLAY_NAME = "Kihda?";

export const POSSESSIVE_PRACTICE_GAME_TYPE = "possessive_practice" as const;

export const POSSESSIVE_TIERS = ["normal", "oblique", "mixed"] as const;

export type PossessiveTier = (typeof POSSESSIVE_TIERS)[number];

export const POSSESSIVE_TIER_LABELS: Record<PossessiveTier, string> = {
  normal: "Normal",
  oblique: "Oblique",
  mixed: "Mixed",
};

export const POSSESSIVE_TIER_DESCRIPTIONS: Record<PossessiveTier, string> = {
  normal: "Pick mera vs meri when the noun stands alone",
  oblique: "Pick the oblique form when a postposition follows (masculine nouns only)",
  mixed: "A mix of normal and oblique questions",
};

export const POSSESSIVE_TIER_FILTER_OPTIONS = POSSESSIVE_TIERS.map((tier) => ({
  id: tier,
  label: POSSESSIVE_TIER_LABELS[tier],
}));
