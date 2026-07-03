import { pickRandomItems, shuffleArray } from "@/lib/flashcards/utils";
import type { McqQuestionPayload } from "@/lib/group-games/buzz-race-types";

export type FlashcardForMcq = {
  id: string;
  front_text: string;
  back_text: string;
  category: string | null;
};

export function buildMcqOptions(
  card: FlashcardForMcq,
  allCards: FlashcardForMcq[]
): string[] {
  const sameCategory = allCards.filter(
    (c) => c.id !== card.id && c.category && c.category === card.category
  );
  let pool =
    sameCategory.length >= 3
      ? sameCategory.map((c) => c.back_text)
      : allCards.filter((c) => c.id !== card.id).map((c) => c.back_text);

  pool = [...new Set(pool.filter((text) => text !== card.back_text))];
  const distractors = pickRandomItems(pool, 3, card.back_text);
  return shuffleArray([card.back_text, ...distractors]);
}

export function buildMcqPayload(
  card: FlashcardForMcq,
  allCards: FlashcardForMcq[]
): McqQuestionPayload {
  return {
    flashcard_id: card.id,
    prompt: card.front_text,
    correct_answer: card.back_text,
    options: buildMcqOptions(card, allCards),
  };
}

export function normalizeFlashcardRow(row: {
  id: string;
  front_text: string | null;
  back_text: string | null;
  category?: string | null;
  difficulty?: number | null;
}): (FlashcardForMcq & { difficulty: number | null }) | null {
  const front_text = row.front_text?.trim() ?? "";
  const back_text = row.back_text?.trim() ?? "";
  if (!front_text || !back_text || front_text === back_text) return null;

  return {
    id: row.id,
    front_text,
    back_text,
    category: row.category?.trim() || null,
    difficulty: row.difficulty ?? null,
  };
}
