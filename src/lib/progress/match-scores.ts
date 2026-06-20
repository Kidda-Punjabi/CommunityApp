import type { SupabaseClient } from "@supabase/supabase-js";
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
};

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
    ...buildGameAccuracyMetadata(score, totalPairs),
  };
  const pointsEarned = await awardGameSessionPoints(supabase, metadata);

  if (!isNewBest) {
    return { isNewBest: false, previousBest, currentBest: previousBest, pointsEarned };
  }

  const { error } = await supabase.from("game_scores").insert({
    user_id: userId,
    game_type: "match",
    score,
    metadata,
    achieved_at: new Date().toISOString(),
  });

  if (error) throw error;

  return { isNewBest: true, previousBest, currentBest: score, pointsEarned };
}
