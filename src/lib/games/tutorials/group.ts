import type { GroupGameType } from "@/lib/game-rooms/types";
import type { TutorialId } from "./types";

/** Map group room game_type → tutorial id (null when no tutorial yet). */
export function tutorialIdForGroupGameType(
  gameType: GroupGameType | string
): TutorialId | null {
  if (gameType === "chado_pauri_group") return "chado_pauri_group";
  if (gameType === "sentence_builder_group") return "sentence_builder_group";
  return null;
}
