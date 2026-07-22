import type { SupabaseClient } from "@supabase/supabase-js";
import type { GameType, UserGameStats } from "./types";
import { awardGameSessionPoints } from "@/lib/leaderboard/points";

export type GameScoreMetadata = Record<string, unknown>;

export async function fetchPersonalBest(
  supabase: SupabaseClient,
  userId: string,
  gameType: GameType,
  metadataFilter?: Partial<GameScoreMetadata>
): Promise<number | null> {
  let query = supabase
    .from("game_scores")
    .select("score, metadata")
    .eq("user_id", userId)
    .eq("game_type", gameType)
    .order("score", { ascending: false })
    .limit(50);

  const { data } = await query;
  if (!data?.length) return null;

  const filtered = metadataFilter
    ? data.filter((row) =>
        Object.entries(metadataFilter).every(
          ([key, value]) => row.metadata?.[key] === value
        )
      )
    : data;

  if (!filtered.length) return null;
  return Math.max(...filtered.map((row) => row.score));
}

export async function fetchPersonalBestsByGame(
  supabase: SupabaseClient,
  userId: string
): Promise<Map<GameType, number>> {
  const { data } = await supabase
    .from("game_scores")
    .select("game_type, score")
    .eq("user_id", userId);

  const bests = new Map<GameType, number>();
  for (const row of data ?? []) {
    const type = row.game_type as GameType;
    const current = bests.get(type) ?? 0;
    if (row.score > current) bests.set(type, row.score);
  }
  return bests;
}

export type GameScoreOutcome = {
  isNewBest: boolean;
  previousBest: number;
  currentBest: number;
  pointsEarned: number;
};

export async function saveGameScore(
  supabase: SupabaseClient,
  userId: string,
  gameType: GameType,
  score: number,
  metadata: GameScoreMetadata = {}
): Promise<GameScoreOutcome> {
  const previousBest = (await fetchPersonalBest(supabase, userId, gameType)) ?? 0;
  const isNewBest = score > previousBest;

  const { error } = await supabase.from("game_scores").insert({
    user_id: userId,
    game_type: gameType,
    score,
    metadata,
    achieved_at: new Date().toISOString(),
  });

  if (error) throw error;

  const pointsEarned = await awardGameSessionPoints(supabase, metadata);

  await updateUserGameStats(supabase, userId, gameType, score);

  return {
    isNewBest,
    previousBest,
    currentBest: isNewBest ? score : previousBest,
    pointsEarned,
  };
}

export async function saveGameScoreIfBest(
  supabase: SupabaseClient,
  userId: string,
  gameType: GameType,
  score: number,
  metadata: GameScoreMetadata = {},
  compareFn?: (next: number, prev: number, meta: GameScoreMetadata) => boolean
): Promise<GameScoreOutcome> {
  const deckName = metadata.deck_name as string | undefined;
  const previousBest =
    (await fetchPersonalBest(
      supabase,
      userId,
      gameType,
      deckName ? { deck_name: deckName } : undefined
    )) ?? 0;

  const isNewBest = compareFn
    ? compareFn(score, previousBest, metadata)
    : score > previousBest;

  if (!isNewBest) {
    const pointsEarned = await awardGameSessionPoints(supabase, metadata);
    await updateUserGameStats(supabase, userId, gameType, score, false);
    return { isNewBest: false, previousBest, currentBest: previousBest, pointsEarned };
  }

  const { error } = await supabase.from("game_scores").insert({
    user_id: userId,
    game_type: gameType,
    score,
    metadata,
    achieved_at: new Date().toISOString(),
  });

  if (error) throw error;

  const pointsEarned = await awardGameSessionPoints(supabase, metadata);

  await updateUserGameStats(supabase, userId, gameType, score, true);

  return { isNewBest: true, previousBest, currentBest: score, pointsEarned };
}

export async function updateUserGameStats(
  supabase: SupabaseClient,
  userId: string,
  gameType: GameType,
  score: number,
  countAsPlayed = true
) {
  const { data: existing } = await supabase
    .from("user_game_stats")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: counts } = await supabase
    .from("game_scores")
    .select("game_type")
    .eq("user_id", userId);

  const tally = new Map<string, number>();
  for (const row of counts ?? []) {
    tally.set(row.game_type, (tally.get(row.game_type) ?? 0) + 1);
  }

  let favouriteGame: string | null = null;
  let maxCount = 0;
  for (const [type, count] of tally) {
    if (count > maxCount) {
      maxCount = count;
      favouriteGame = type;
    }
  }

  const payload = {
    user_id: userId,
    total_games_played: (existing?.total_games_played ?? 0) + (countAsPlayed ? 1 : 0),
    favourite_game: favouriteGame,
    highest_streak_survival_score:
      gameType === "streak_survival"
        ? Math.max(existing?.highest_streak_survival_score ?? 0, score)
        : (existing?.highest_streak_survival_score ?? 0),
    updated_at: new Date().toISOString(),
  };

  await supabase.from("user_game_stats").upsert(payload, { onConflict: "user_id" });
}

export async function fetchUserGameStats(
  supabase: SupabaseClient,
  userId: string
): Promise<UserGameStats | null> {
  const { data } = await supabase
    .from("user_game_stats")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  return data as UserGameStats | null;
}
