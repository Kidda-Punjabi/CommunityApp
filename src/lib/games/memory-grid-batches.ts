import type { FlashcardDeckCard } from "@/lib/flashcards/types";
import { shuffleArray } from "@/lib/flashcards/utils";

export const MEMORY_GRID_PAIRS_PER_BATCH = 6;

/** Split cards into batches of up to 6 pairs; shuffle order each game. */
export function createMemoryGridBatches(cards: FlashcardDeckCard[]): FlashcardDeckCard[][] {
  const shuffled = shuffleArray(cards);
  if (shuffled.length <= MEMORY_GRID_PAIRS_PER_BATCH) {
    return [shuffled];
  }

  const batches: FlashcardDeckCard[][] = [];
  for (let i = 0; i < shuffled.length; i += MEMORY_GRID_PAIRS_PER_BATCH) {
    batches.push(shuffled.slice(i, i + MEMORY_GRID_PAIRS_PER_BATCH));
  }
  return batches;
}

export type MemoryGridTile = {
  id: string;
  cardId: string;
  text: string;
  romanised: string | null;
  side: "front" | "back";
};

/** Build 12 shuffled tiles (6 pairs) from the given pair cards. */
export function buildGridTilesFromPairs(cards: FlashcardDeckCard[]): MemoryGridTile[] {
  const list: MemoryGridTile[] = [];
  for (const card of cards) {
    list.push({
      id: `${card.id}-front`,
      cardId: card.id,
      text: card.front_text,
      romanised: null,
      side: "front",
    });
    list.push({
      id: `${card.id}-back`,
      cardId: card.id,
      text: card.back_text,
      romanised: card.romanised,
      side: "back",
    });
  }
  return shuffleArray(list);
}
