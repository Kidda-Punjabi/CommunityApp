import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChallengeSubmitResult } from "./types";

export async function submitFriendGameChallengeScore(
  supabase: SupabaseClient,
  challengeId: string,
  score: number,
  scoreMetadata: Record<string, unknown> = {}
): Promise<ChallengeSubmitResult> {
  const { data, error } = await supabase.rpc("submit_friend_game_challenge_score", {
    p_challenge_id: challengeId,
    p_score: score,
    p_score_metadata: scoreMetadata,
  });

  if (error) throw error;

  const row = data as {
    status: ChallengeSubmitResult["status"];
    role: ChallengeSubmitResult["role"];
    your_score: number;
    winner_id?: string | null;
    is_tie?: boolean;
    challenger_score?: number;
  };

  return {
    status: row.status,
    role: row.role,
    yourScore: row.your_score,
    winnerId: row.winner_id,
    isTie: row.is_tie,
    challengerScore: row.challenger_score,
  };
}
