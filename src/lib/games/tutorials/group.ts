import type { GroupGameType } from "@/lib/game-rooms/types";
import type { TutorialId } from "./types";

/** Map group room game_type → tutorial id (null when no tutorial yet). */
export function tutorialIdForGroupGameType(
  gameType: GroupGameType | string
): TutorialId | null {
  if (gameType === "buzz_in") return "buzz_in";
  if (gameType === "jeopardy") return "jeopardy";
  if (gameType === "point_race") return "point_race";
  if (gameType === "sound_match_group") return "sound_match_group";
  if (gameType === "vowel_match_group") return "vowel_match_group";
  if (gameType === "chado_pauri_group") return "chado_pauri_group";
  if (gameType === "sentence_builder_group") return "sentence_builder_group";
  return null;
}
