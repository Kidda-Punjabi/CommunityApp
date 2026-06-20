export type ProgressionTier = {
  tier: number;
  name: string;
  description: string;
};

/** Single source of truth for learner levels — onboarding, profile, placement, tests. */
export const PROGRESSION_TIERS: ProgressionTier[] = [
  {
    tier: 1,
    name: "Complete Beginner",
    description: "No knowledge of Punjabi yet.",
  },
  {
    tier: 2,
    name: "Sound Builder",
    description: "Knows basic sounds and can pronounce or form simple words.",
  },
  {
    tier: 3,
    name: "Listener",
    description: "Can understand basic questions.",
  },
  {
    tier: 4,
    name: "Responder",
    description: "Can respond to basic questions and use learned phrases.",
  },
  {
    tier: 5,
    name: "Grammar Starter",
    description: "Understands basic grammar and applies it to simple sentences.",
  },
  {
    tier: 6,
    name: "Sentence Creator",
    description: "Builds own sentences across tenses about everyday topics.",
  },
  {
    tier: 7,
    name: "Conversationalist",
    description: "Holds real conversation and recovers when stuck.",
  },
  {
    tier: 8,
    name: "Fluent Speaker",
    description: "Converses naturally on any topic.",
  },
];

export function getTierByNumber(tier: number): ProgressionTier {
  return PROGRESSION_TIERS.find((entry) => entry.tier === tier) ?? PROGRESSION_TIERS[0];
}

export function getNextTier(currentTier: number): ProgressionTier | null {
  if (currentTier >= 8) return null;
  return getTierByNumber(currentTier + 1);
}

/** Transition test label, e.g. "Level 3 → 4 Test" */
export function levelTestLabel(fromLevel: number): string {
  return `Level ${fromLevel} → ${fromLevel + 1} Test`;
}
