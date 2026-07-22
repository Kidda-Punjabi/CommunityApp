import type { SupabaseClient } from "@supabase/supabase-js";
import { updateUserGameStats } from "@/lib/games/game-scores";
import {
  awardGameSessionPoints,
  buildGameAccuracyMetadata,
} from "@/lib/leaderboard/points";

export type MatchScoreRow = {
  deck_name: string;
  best_score: number;
  best_time_seconds: number;
  achieved_at: string;
};

export async function fetchMatchScore(
  supabase: SupabaseClient,
  userId: string,
  deckName: string
): Promise<MatchScoreRow | null> {
  const { data } = await supabase
    .from("game_scores")
    .select("score, metadata, achieved_at")
    .eq("user_id", userId)
    .eq("game_type", "match")
    .eq("metadata->>deck_name", deckName)
    .order("score", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    deck_name: deckName,
    best_score: data.score,
    best_time_seconds: (data.metadata?.time_seconds as number) ?? 60,
    achieved_at: data.achieved_at,
  };
}

export type SaveMatchScoreResult = {
  isNewBest: boolean;
  previousBest: number;
  currentBest: number;
  pointsEarned: number;
  saved: boolean;
};

/**
 * Persists every completed Match session to game_scores (session history).
 * `isNewBest` reflects deck personal best; UI uses it for “new PB” messaging.
 */
export async function saveMatchScoreIfBest(
  supabase: SupabaseClient,
  userId: string,
  deckName: string,
  score: number,
  timeSeconds: number,
  totalPairs: number
): Promise<SaveMatchScoreResult> {
  const existing = await fetchMatchScore(supabase, userId, deckName);
  const previousBest = existing?.best_score ?? 0;
  const previousTime = existing?.best_time_seconds ?? 60;

  const isNewBest =
    score > previousBest || (score === previousBest && timeSeconds < previousTime);

  const metadata = {
    deck_name: deckName,
    time_seconds: timeSeconds,
    save_via: "always_insert_v2",
    ...buildGameAccuracyMetadata(score, totalPairs),
  };

  const { data: inserted, error } = await supabase
    .from("game_scores")
    .insert({
      user_id: userId,
      game_type: "match",
      score,
      metadata,
      achieved_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw error;
  if (!inserted?.id) {
    throw new Error("Match score insert returned no row id");
  }

  const pointsEarned = await awardGameSessionPoints(supabase, metadata);
  await updateUserGameStats(supabase, userId, "match", score, isNewBest);

  return {
    isNewBest,
    previousBest,
    currentBest: isNewBest ? score : previousBest,
    pointsEarned,
    saved: true,
  };
}
