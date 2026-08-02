import type { ChadoPauriFlashcard } from "./types";

export function countCardsByDifficulty(
  cards: ChadoPauriFlashcard[]
): Record<number, number> {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const card of cards) {
    const tier = Math.min(5, Math.max(1, card.difficulty));
    counts[tier] = (counts[tier] ?? 0) + 1;
  }
  return counts;
}
