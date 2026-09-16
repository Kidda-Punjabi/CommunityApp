import { shuffleSeeded } from "../challenges/seeded-random";
import type { FlashcardDeckCard } from "./types";
import { shuffleArray } from "./utils";

export const MATCH_SECONDS_PER_PAIR = 10;
export const MATCH_PAIRS_PER_SCREEN = 4;

export type MatchTile = {
  id: string;
  cardId: string;
  text: string;
  romanised: string | null;
};

export function matchGameSeconds(pairCount: number): number {
  return Math.max(0, pairCount) * MATCH_SECONDS_PER_PAIR;
}

export function chunkPairs<T>(
  items: T[],
  size = MATCH_PAIRS_PER_SCREEN
): T[][] {
  if (items.length === 0) return [];
  const chunkSize = Math.max(1, size);
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

export function cardsToMatchTiles(cards: FlashcardDeckCard[]): MatchTile[] {
  const list: MatchTile[] = [];
  for (const card of cards) {
    list.push({
      id: `${card.id}-front`,
      cardId: card.id,
      text: card.front_text,
      romanised: card.romanised,
    });
    list.push({
      id: `${card.id}-back`,
      cardId: card.id,
      text: card.back_text,
      romanised: card.romanised,
    });
  }
  return list;
}

export function buildMatchTileChunks(
  cards: FlashcardDeckCard[],
  seed?: number | null
): MatchTile[][] {
  const ordered =
    seed != null ? shuffleSeeded(cards, seed) : shuffleArray(cards);
  return chunkPairs(ordered, MATCH_PAIRS_PER_SCREEN).map((chunk, index) => {
    const tiles = cardsToMatchTiles(chunk);
    return seed != null
      ? shuffleSeeded(tiles, seed + index + 1)
      : shuffleArray(tiles);
  });
}
