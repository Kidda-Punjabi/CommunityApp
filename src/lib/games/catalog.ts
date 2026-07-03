import { CHADO_PAURI_DISPLAY_NAME } from "@/lib/games/chado-pauri/config";
import type { GameType } from "./types";

export const GAMES_HUB_HREF = "/dashboard/games";

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
    title: "Translation Sprint",
    description: "Pick the correct translation before you run out of lives — faster answers score more",
    emoji: "💨",
    section: "vocabulary",
    href: "/dashboard/games/speed-translate",
    needsDeck: true,
  },
  {
    type: "picture_match",
    title: "Picture Match",
    description: "See the picture and pick the correct Punjabi word",
    emoji: "🖼️",
    section: "vocabulary",
    href: "/dashboard/games/picture-match",
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
    description: "Tap word tiles in order to build Punjabi sentences from English prompts",
    emoji: "🧩",
    section: "grammar",
    href: "/dashboard/games/sentence-builder",
  },
  {
    type: "conjugation_challenge",
    title: "Conjugation Challenge",
    description: "10-question multiple-choice round across 15 tense patterns",
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
  {
    type: "voice_practice",
    title: "Speak It",
    description: "Read a Punjabi sentence aloud and get instant pronunciation feedback",
    emoji: "🎙️",
    section: "grammar",
    href: "/dashboard/games/voice-practice",
  },
  {
    type: "chado_pauri",
    title: CHADO_PAURI_DISPLAY_NAME,
    description: "Climb nine rungs — one wrong answer ends the run",
    emoji: "🪜",
    section: "vocabulary",
    href: "/dashboard/games/chado-pauri",
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
