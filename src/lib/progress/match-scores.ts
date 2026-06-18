import type { SupabaseClient } from "@supabase/supabase-js";

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
    .from("match_scores")
    .select("deck_name, best_score, best_time_seconds, achieved_at")
    .eq("user_id", userId)
    .eq("deck_name", deckName)
    .maybeSingle();

  return data;
}

export type SaveMatchScoreResult = {
  isNewBest: boolean;
  previousBest: number;
  currentBest: number;
};

export async function saveMatchScoreIfBest(
  supabase: SupabaseClient,
  userId: string,
  deckName: string,
  score: number,
  timeSeconds: number
): Promise<SaveMatchScoreResult> {
  const existing = await fetchMatchScore(supabase, userId, deckName);
  const previousBest = existing?.best_score ?? 0;

  const isNewBest =
    score > previousBest ||
    (score === previousBest && timeSeconds < (existing?.best_time_seconds ?? 60));

  if (!isNewBest) {
    return { isNewBest: false, previousBest, currentBest: previousBest };
  }

  const { error } = await supabase.from("match_scores").upsert(
    {
      user_id: userId,
      deck_name: deckName,
      best_score: score,
      best_time_seconds: timeSeconds,
      achieved_at: new Date().toISOString(),
    },
    { onConflict: "user_id,deck_name" }
  );

  if (error) throw error;

  return { isNewBest: true, previousBest, currentBest: score };
}
