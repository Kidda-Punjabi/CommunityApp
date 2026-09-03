import type { FlashcardDeckCard } from "./types";

export function getDeckName(cards: Pick<FlashcardDeckCard, "deck_name">[]) {
  return cards[0]?.deck_name?.trim() || "Deck";
}

export function resolveDeckName(
  cards: Pick<FlashcardDeckCard, "deck_name">[],
  setName?: string | null
) {
  return setName?.trim() || getDeckName(cards);
}

export function deckPracticeHref(
  lessonId: string,
  deckId: string,
  mode?: "study" | "match" | "test"
) {
  const base = `/dashboard/practice/flashcards/${lessonId}/${deckId}`;
  return mode ? `${base}/${mode}` : base;
}

export function gameDeckHref(
  gameSlug: string,
  lessonId: string,
  deckId: string
) {
  return `/dashboard/games/${gameSlug}/${lessonId}/${deckId}`;
}

export function gameDeckHubHref(gameSlug: string) {
  return `/dashboard/games/${gameSlug}`;
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

/** Trimmed, case-insensitive key so MCQ options never collide on equivalent text. */
export function normalizeOptionText(text: string): string {
  return text.trim().toLowerCase();
}

/**
 * Pick up to `count` strings whose normalized text is unique, excluding `exclude`.
 * Returns fewer than `count` when the pool does not have enough distinct values.
 */
export function pickDistinctTexts(
  items: string[],
  count: number,
  exclude?: string
): string[] {
  const seen = new Set<string>();
  if (exclude != null) {
    const excluded = normalizeOptionText(exclude);
    if (excluded) seen.add(excluded);
  }

  const picked: string[] = [];
  for (const item of shuffleArray(items)) {
    const key = normalizeOptionText(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    picked.push(item);
    if (picked.length >= count) break;
  }
  return picked;
}
