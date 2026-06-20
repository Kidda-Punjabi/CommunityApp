"use server";

import { createClient } from "@/lib/supabase/server";
import { buildChallengeConfig, challengePlayHref } from "@/lib/challenges/config";
import type { ChallengeConfig } from "@/lib/challenges/types";
import type { GameType } from "@/lib/games/types";
import { revalidatePath } from "next/cache";

export type ActionResult = { error?: string; success?: string; playHref?: string };

export async function createFriendChallenge(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const challengedId = String(formData.get("friend_id") ?? "").trim();
  const gameType = String(formData.get("game_type") ?? "").trim() as GameType;
  const configJson = String(formData.get("config") ?? "").trim();

  if (!challengedId) return { error: "Pick a friend to challenge." };
  if (!gameType) return { error: "Pick a game mode." };

  let configInput: Partial<ChallengeConfig> = {};
  if (configJson) {
    try {
      configInput = JSON.parse(configJson) as Partial<ChallengeConfig>;
    } catch {
      return { error: "Invalid challenge settings." };
    }
  }

  const config = buildChallengeConfig(configInput);
  const supabase = await createClient();

  const { data: challengeId, error } = await supabase.rpc("create_friend_game_challenge", {
    p_challenged_id: challengedId,
    p_game_type: gameType,
    p_config: config,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/challenges");
  revalidatePath("/dashboard/friends");

  return {
    success: "Challenge created! Starting your run…",
    playHref: challengePlayHref(challengeId as string, gameType, config),
  };
}
