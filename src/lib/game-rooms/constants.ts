import type { GroupGameType } from "@/lib/game-rooms/types";

export const GROUP_GAME_TYPES = [
  "buzz_in",
  "jeopardy",
  "chado_pauri_group",
  "sentence_builder_group",
  "point_race",
  "sound_match_group",
  "vowel_match_group",
] as const satisfies readonly GroupGameType[];

export const GROUP_GAME_LABELS: Record<GroupGameType, string> = {
  buzz_in: "Buzz-in",
  jeopardy: "Jeopardy",
  chado_pauri_group: "Chado Pauri (Group)",
  sentence_builder_group: "Collaborative Sentence Builder",
  point_race: "Point Race",
  sound_match_group: "Sound Match",
  vowel_match_group: "Vowel Match",
};

export const DEFAULT_QUESTION_COUNT = 10;
