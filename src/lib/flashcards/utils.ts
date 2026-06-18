import type { FlashcardDeckCard } from "./types";

export function getDeckName(cards: Pick<FlashcardDeckCard, "deck_name">[]) {
  return cards[0]?.deck_name?.trim() || "Deck";
}

export function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function pickRandomItems<T>(items: T[], count: number, exclude?: T): T[] {
  const pool = exclude ? items.filter((item) => item !== exclude) : [...items];
  return shuffleArray(pool).slice(0, count);
}
