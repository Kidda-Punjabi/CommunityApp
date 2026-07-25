import type { FlashcardDeckCard } from "@/lib/flashcards/types";
import type { SpeakingPracticeCard } from "@/lib/games/speaking-practice";

const GURMUKHI = /[\u0A00-\u0A7F]/;

export function containsGurmukhi(text: string): boolean {
  return GURMUKHI.test(text);
}

/** Strip trailing (romanised) from community flashcard backs. */
export function stripTrailingRomanisation(text: string): {
  gurmukhi: string;
  romanised: string | null;
} {
  const match = text.trim().match(/^(.*?)\s*\(([^)]+)\)\s*$/u);
  if (match && GURMUKHI.test(match[1])) {
    return { gurmukhi: match[1].trim(), romanised: match[2].trim() };
  }
  return { gurmukhi: text.trim(), romanised: null };
}

/** Clean Gurmukhi + best available romanisation for a flashcard. */
export function cardPunjabiDisplay(card: FlashcardDeckCard): {
  gurmukhi: string;
  romanised: string;
} {
  const parsed = stripTrailingRomanisation(card.back_text ?? "");
  return {
    gurmukhi: parsed.gurmukhi,
    romanised: card.romanised?.trim() || parsed.romanised || "",
  };
}

/** Map clean Gurmukhi (and raw back_text) → romanisation for option lookup. */
export function buildRomanisationLookup(
  cards: FlashcardDeckCard[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const card of cards) {
    const { gurmukhi, romanised } = cardPunjabiDisplay(card);
    if (!romanised) continue;
    map.set(gurmukhi, romanised);
    const raw = card.back_text?.trim();
    if (raw) map.set(raw, romanised);
  }
  return map;
}

export function flashcardToSpeakingCard(
  card: FlashcardDeckCard
): SpeakingPracticeCard | null {
  const front = card.front_text?.trim() ?? "";
  const { gurmukhi: punjabi, romanised } = cardPunjabiDisplay(card);
  if (!front || !punjabi || !romanised) return null;
  if (GURMUKHI.test(front) || !GURMUKHI.test(punjabi)) return null;

  return {
    id: card.id,
    english: front,
    punjabi,
    romanised,
    iconName: card.icon_name ?? null,
    difficulty: 1,
  };
}

export function shuffleInPlace<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function pickCards(cards: FlashcardDeckCard[], count: number): FlashcardDeckCard[] {
  return shuffleInPlace(cards).slice(0, Math.min(count, cards.length));
}
