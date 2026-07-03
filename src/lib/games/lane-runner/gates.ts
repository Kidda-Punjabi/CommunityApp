import { shuffleArray } from "@/lib/flashcards/utils";
import { pickCycledPool } from "@/lib/games/session-settings";
import type {
  LaneAnswerOption,
  LaneIndex,
  LaneRunnerFlashcard,
  LaneRunnerGate,
} from "./types";

function uniqueByBackText(cards: LaneRunnerFlashcard[]): LaneRunnerFlashcard[] {
  const seen = new Set<string>();
  const result: LaneRunnerFlashcard[] = [];
  for (const card of cards) {
    const key = card.back_text.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(card);
  }
  return result;
}

function answerOption(card: LaneRunnerFlashcard): LaneAnswerOption {
  return {
    gurmukhi: card.back_text,
    romanised: card.romanised?.trim() || "—",
  };
}

/**
 * Distractors: prefer same category as the prompt card; widen to full pool if
 * fewer than two same-category backs exist (never errors).
 */
export function pickDistractorCards(
  promptCard: LaneRunnerFlashcard,
  allCards: LaneRunnerFlashcard[],
  count: number
): LaneRunnerFlashcard[] {
  const correctBack = promptCard.back_text.trim().toLowerCase();

  const sameCategory = uniqueByBackText(
    allCards.filter(
      (card) =>
        card.id !== promptCard.id &&
        card.back_text.trim().toLowerCase() !== correctBack &&
        card.category &&
        promptCard.category &&
        card.category === promptCard.category
    )
  );

  const fallbackPool = uniqueByBackText(
    allCards.filter(
      (card) =>
        card.id !== promptCard.id && card.back_text.trim().toLowerCase() !== correctBack
    )
  );

  const pool = sameCategory.length >= count ? sameCategory : fallbackPool;
  return shuffleArray(pool).slice(0, count);
}

export function buildLaneRunnerGate(
  promptCard: LaneRunnerFlashcard,
  allCards: LaneRunnerFlashcard[]
): LaneRunnerGate | null {
  const distractors = pickDistractorCards(promptCard, allCards, 2);
  if (distractors.length < 2) return null;

  const options = shuffleArray([
    answerOption(promptCard),
    answerOption(distractors[0]),
    answerOption(distractors[1]),
  ]);

  const correctLane = options.findIndex(
    (option) => option.gurmukhi === promptCard.back_text
  ) as LaneIndex;
  if (correctLane < 0 || correctLane > 2) return null;

  return {
    flashcard_id: promptCard.id,
    prompt: promptCard.front_text,
    laneAnswers: [options[0], options[1], options[2]],
    correctLane,
  };
}

export function buildLaneRunnerRound(
  allCards: LaneRunnerFlashcard[],
  gateCount: number
): LaneRunnerGate[] {
  const picked = pickCycledPool(allCards, gateCount);
  const gates: LaneRunnerGate[] = [];

  for (const card of picked) {
    const gate = buildLaneRunnerGate(card, allCards);
    if (gate) gates.push(gate);
  }

  return gates;
}
