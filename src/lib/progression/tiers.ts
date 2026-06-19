export type ProgressionTier = {
  tier: number;
  name: string;
  description: string;
  minScore: number;
  maxScore: number;
};

/** Edit tier copy here — single source of truth for onboarding + profile. */
export const PROGRESSION_TIERS: ProgressionTier[] = [
  {
    tier: 1,
    name: "Starting out",
    description: "You're learning the alphabet, sounds, and basic greetings.",
    minScore: 0,
    maxScore: 9,
  },
  {
    tier: 2,
    name: "First phrases",
    description:
      "You can ask the 6 question words and form simple sentences using the Punjabi sentence structure.",
    minScore: 10,
    maxScore: 22,
  },
  {
    tier: 3,
    name: "Everyday actions",
    description:
      "You can describe what you and others do, using correct verb roots and present tense.",
    minScore: 23,
    maxScore: 35,
  },
  {
    tier: 4,
    name: "Connector",
    description:
      "You can link ideas together, describe abilities, and express wants and needs.",
    minScore: 36,
    maxScore: 48,
  },
  {
    tier: 5,
    name: "Storyteller",
    description:
      "You can talk about the past — what happened, what you used to do, what you'd already done.",
    minScore: 49,
    maxScore: 61,
  },
  {
    tier: 6,
    name: "Forward thinker",
    description:
      "You can talk about the future and ask detailed questions with confidence.",
    minScore: 62,
    maxScore: 74,
  },
  {
    tier: 7,
    name: "Confident speaker",
    description:
      "You can give instructions, use correct grammar across nearly all tenses, and hold real conversations.",
    minScore: 75,
    maxScore: 87,
  },
  {
    tier: 8,
    name: "Fluent",
    description:
      "You can speak naturally and accurately across all tenses and contexts taught in the course.",
    minScore: 88,
    maxScore: 100,
  },
];

export function getTierByNumber(tier: number): ProgressionTier {
  return PROGRESSION_TIERS.find((entry) => entry.tier === tier) ?? PROGRESSION_TIERS[0];
}

export function getTierForScore(score: number): ProgressionTier {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return (
    [...PROGRESSION_TIERS].reverse().find((entry) => clamped >= entry.minScore) ??
    PROGRESSION_TIERS[0]
  );
}

export function getNextTier(currentTier: number): ProgressionTier | null {
  if (currentTier >= 8) return null;
  return getTierByNumber(currentTier + 1);
}

export function scoreForSelfAssessedTier(tier: number): number {
  const entry = getTierByNumber(tier);
  return Math.round((entry.minScore + entry.maxScore) / 2);
}
