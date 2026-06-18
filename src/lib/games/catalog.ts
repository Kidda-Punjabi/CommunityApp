import type { GameType } from "./types";

export type GameCatalogEntry = {
  type: GameType;
  title: string;
  description: string;
  emoji: string;
  section: "vocabulary" | "grammar";
  href: string;
  needsDeck?: boolean;
};

export const GAME_CATALOG: GameCatalogEntry[] = [
  {
    type: "match",
    title: "Match",
    description: "Pair Punjabi fronts and backs against the clock",
    emoji: "⚡",
    section: "vocabulary",
    href: "/dashboard/games/match",
    needsDeck: true,
  },
  {
    type: "memory_grid",
    title: "Memory Grid",
    description: "Flip cards and find matching pairs from memory",
    emoji: "🧠",
    section: "vocabulary",
    href: "/dashboard/games/memory-grid",
    needsDeck: true,
  },
  {
    type: "speed_translate",
    title: "Speed Translate",
    description: "Pick the correct translation before you run out of lives",
    emoji: "💨",
    section: "vocabulary",
    href: "/dashboard/games/speed-translate",
    needsDeck: true,
  },
  {
    type: "word_scramble",
    title: "Word Scramble",
    description: "Tap letters in order to rebuild scrambled Punjabi words",
    emoji: "🔤",
    section: "vocabulary",
    href: "/dashboard/games/word-scramble",
    needsDeck: true,
  },
  {
    type: "streak_survival",
    title: "Streak Survival",
    description: "One wrong answer ends the run — how long can you survive?",
    emoji: "🔥",
    section: "vocabulary",
    href: "/dashboard/games/streak-survival",
  },
  {
    type: "sentence_builder",
    title: "Sentence Builder",
    description: "Arrange Punjabi word tiles into the correct sentence",
    emoji: "🧩",
    section: "grammar",
    href: "/dashboard/games/sentence-builder",
  },
  {
    type: "conjugation_challenge",
    title: "Conjugation Challenge",
    description: "Pick the right verb form for tense, number, and gender",
    emoji: "📝",
    section: "grammar",
    href: "/dashboard/games/conjugation-challenge",
  },
  {
    type: "gender_sort",
    title: "Gender Sort",
    description: "Swipe or tap to sort nouns as masculine or feminine",
    emoji: "↔️",
    section: "grammar",
    href: "/dashboard/games/gender-sort",
  },
];

export function gameDeckPlayHref(
  gameSlug: string,
  lessonId: string,
  deckId: string
) {
  return `/dashboard/games/${gameSlug}/${lessonId}/${deckId}`;
}

export function gameSlugForType(type: GameType): string {
  return type.replace(/_/g, "-");
}
