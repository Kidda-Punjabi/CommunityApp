import type { McqQuestionPayload } from "@/lib/group-games/buzz-race-types";
import { pickRandomItems, shuffleArray } from "@/lib/flashcards/utils";

export type FlashcardForMcq = {
  id: string;
  front_text: string;
  back_text: string;
  romanised: string | null;
  category: string | null;
};

function romanisedForBackText(
  text: string,
  cards: FlashcardForMcq[]
): string | null {
  const match = cards.find((c) => c.back_text === text);
  return match?.romanised?.trim() || null;
}

export function buildMcqOptions(
  card: FlashcardForMcq,
  allCards: FlashcardForMcq[]
): { options: string[]; options_romanised: (string | null)[] } {
  const sameCategory = allCards.filter(
    (c) => c.id !== card.id && c.category && c.category === card.category
  );
  let poolCards =
    sameCategory.length >= 3
      ? sameCategory
      : allCards.filter((c) => c.id !== card.id);

  const uniqueByBack = new Map<string, FlashcardForMcq>();
  for (const c of poolCards) {
    if (c.back_text === card.back_text) continue;
    if (!uniqueByBack.has(c.back_text)) uniqueByBack.set(c.back_text, c);
  }
  const pool = [...uniqueByBack.keys()];
  const distractors = pickRandomItems(pool, 3, card.back_text);
  const options = shuffleArray([card.back_text, ...distractors]);
  const options_romanised = options.map((text) =>
    text === card.back_text
      ? card.romanised
      : romanisedForBackText(text, allCards)
  );
  return { options, options_romanised };
}

export function buildMcqPayload(
  card: FlashcardForMcq,
  allCards: FlashcardForMcq[]
): McqQuestionPayload {
  const { options, options_romanised } = buildMcqOptions(card, allCards);
  return {
    flashcard_id: card.id,
    prompt: card.front_text,
    prompt_romanised: null,
    correct_answer: card.back_text,
    options,
    options_romanised,
  };
}

export function normalizeFlashcardRow(row: {
  id: string;
  front_text: string | null;
  back_text: string | null;
  romanised?: string | null;
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
    romanised: row.romanised?.trim() || null,
    category: row.category?.trim() || null,
    difficulty: row.difficulty ?? null,
  };
}
