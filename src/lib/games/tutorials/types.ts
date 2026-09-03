import type { GameType } from "@/lib/games/types";

/** Solo catalog games plus group-arena tutorial keys. */
export type TutorialId =
  | GameType
  | "buzz_in"
  | "jeopardy"
  | "point_race"
  | "sound_match_group"
  | "vowel_match_group"
  | "chado_pauri_group"
  | "sentence_builder_group";

export type GameTutorialContent = {
  id: TutorialId;
  title: string;
  steps: [string, string, ...string[]];
  ctaLabel?: string;
};

export function isTutorialId(value: string): value is TutorialId {
  return value in TUTORIAL_ID_SET;
}

const TUTORIAL_ID_SET: Record<TutorialId, true> = {
  match: true,
  memory_grid: true,
  speed_translate: true,
  picture_match: true,
  streak_survival: true,
  sentence_builder: true,
  conjugation_challenge: true,
  gender_sort: true,
  voice_practice: true,
  chado_pauri: true,
  conversation_practice: true,
  possessive_practice: true,
  spot_the_mistake: true,
  comprehension_practice: true,
  lane_runner: true,
  speaking_practice: true,
  vowel_match: true,
  sound_match: true,
  word_start: true,
  buzz_in: true,
  jeopardy: true,
  point_race: true,
  sound_match_group: true,
  vowel_match_group: true,
  chado_pauri_group: true,
  sentence_builder_group: true,
};
