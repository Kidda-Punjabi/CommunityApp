export const LEVEL_TEST_PASS_PCT = 95;
export const LEVEL_TEST_QUESTION_COUNT = 30;

/** Placement: 70–94% on confirmation test → placed one level below claim. */
export const PLACEMENT_CLOSE_MIN_PCT = 70;

/** Placement: below this on confirmation test triggers one follow-up test. */
export const PLACEMENT_LOW_MAX_PCT = 69;

export type LevelTestMcqOption = {
  id: string;
  textGurmukhi?: string;
  textRomanised?: string;
  textEnglish?: string;
};

export type LevelTestMcqQuestion = {
  kind: "mcq";
  id: string;
  from_level: number;
  question_order: number;
  questionGurmukhi?: string;
  questionRomanised?: string;
  questionEnglish: string;
  options: LevelTestMcqOption[];
  correctOptionId: string;
};

export type LevelTestConjugationOption = {
  id: string;
  gurmukhi: string;
  romanised?: string;
};

export type LevelTestConjugationQuestion = {
  kind: "conjugation_fill_blank";
  id: string;
  from_level: number;
  question_order: number;
  punjabiSentenceWithBlank: string;
  punjabiSentenceRomanised?: string;
  englishTranslation: string;
  options: LevelTestConjugationOption[];
  correctOptionId: string;
};

export type LevelTestSentenceTile = {
  id: string;
  gurmukhi: string;
  romanised: string;
};

export type LevelTestSentenceBuilderQuestion = {
  kind: "sentence_builder";
  id: string;
  from_level: number;
  question_order: number;
  englishPrompt: string;
  correctTiles: string[];
  correctRomanised?: string;
  tiles: LevelTestSentenceTile[];
};

export type LevelTestQuestion =
  | LevelTestMcqQuestion
  | LevelTestConjugationQuestion
  | LevelTestSentenceBuilderQuestion;

/** Which transition test confirms a self-assessed level (boundary below claim). */
export function confirmationTestFromLevel(claimedLevel: number): number {
  if (claimedLevel <= 1) return 1;
  return claimedLevel - 1;
}

/** Follow-up test when confirmation score is in the "low" band — always Level 1→2. */
export function followUpTestFromLevel(): number {
  return 1;
}

export type PlacementOutcome = {
  placedLevel: number;
  message: string;
  needsFollowUp: boolean;
};

export function resolvePlacementAfterFirstTest(
  claimedLevel: number,
  scorePct: number
): PlacementOutcome {
  if (claimedLevel === 1) {
    if (scorePct >= LEVEL_TEST_PASS_PCT) {
      return {
        placedLevel: 2,
        message:
          "Great work — you've graduated to Level 2. You're ready to move beyond the basics.",
        needsFollowUp: false,
      };
    }

    return {
      placedLevel: 1,
      message:
        "Level 1 is confirmed — you're at the very beginning of your journey, and that's a perfect place to start.",
      needsFollowUp: false,
    };
  }

  if (scorePct >= LEVEL_TEST_PASS_PCT) {
    return {
      placedLevel: claimedLevel,
      message: `Nice work — Level ${claimedLevel} looks like the right starting point for you.`,
      needsFollowUp: false,
    };
  }

  if (scorePct >= PLACEMENT_CLOSE_MIN_PCT) {
    const placedLevel = Math.max(1, claimedLevel - 1);
    return {
      placedLevel,
      message: `Based on this, Level ${placedLevel} looks like the right starting point — you'll learn at the right pace rather than jumping in too far ahead.`,
      needsFollowUp: false,
    };
  }

  return {
    placedLevel: claimedLevel,
    message: "Let's try a shorter check at a lower level to find the best starting point.",
    needsFollowUp: true,
  };
}

export function resolvePlacementAfterFollowUp(
  followUpPassed: boolean
): PlacementOutcome {
  if (followUpPassed) {
    return {
      placedLevel: 2,
      message: "Level 2 looks like the right starting point for you.",
      needsFollowUp: false,
    };
  }

  return {
    placedLevel: 1,
    message: "Level 1 is the right place to start — we'll build from the basics together.",
    needsFollowUp: false,
  };
}

export function testPassed(scorePct: number): boolean {
  return scorePct >= LEVEL_TEST_PASS_PCT;
}
