import { getDisplayName } from "@/lib/profile/display-name";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GameType } from "@/lib/games/types";
import type { GameSessionSettingsChoice } from "@/lib/games/session-settings";
import type {
  ChallengeConfig,
  ChallengeParticipant,
  ChallengeStatus,
  FriendGameChallenge,
  StreakSurvivalVariant,
} from "./types";

type RawChallenge = {
  id: string;
  game_type: GameType;
  config: ChallengeConfig | null;
  status: ChallengeStatus;
  challenger_id: string;
  challenged_id: string;
  challenger_score: number | null;
  challenged_score: number | null;
  challenger_score_metadata: Record<string, unknown> | null;
  challenged_score_metadata: Record<string, unknown> | null;
  winner_id: string | null;
  is_tie: boolean;
  your_role: "challenger" | "challenged";
  challenger: ChallengeParticipant;
  challenged: ChallengeParticipant;
  created_at: string;
  completed_at: string | null;
};

function parseConfig(raw: unknown): ChallengeConfig {
  const config = (raw ?? {}) as Record<string, unknown>;
  const session = config.session as GameSessionSettingsChoice | undefined;
  const deck = config.deck as ChallengeConfig["deck"] | undefined;
  const streakVariant = config.streakVariant as StreakSurvivalVariant | undefined;
  const seed = typeof config.seed === "number" ? config.seed : 1;

  return { seed, session, deck, streakVariant };
}

function mapChallenge(raw: RawChallenge): FriendGameChallenge {
  return {
    id: raw.id,
    gameType: raw.game_type,
    config: parseConfig(raw.config),
    status: raw.status,
    challengerId: raw.challenger_id,
    challengedId: raw.challenged_id,
    challengerScore: raw.challenger_score,
    challengedScore: raw.challenged_score,
    challengerScoreMetadata: raw.challenger_score_metadata ?? {},
    challengedScoreMetadata: raw.challenged_score_metadata ?? {},
    winnerId: raw.winner_id,
    isTie: raw.is_tie,
    yourRole: raw.your_role,
    challenger: raw.challenger,
    challenged: raw.challenged,
    createdAt: raw.created_at,
    completedAt: raw.completed_at,
  };
}

function isMissingChallengeSchema(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("friend_game_challenges") || lower.includes("get_friend_game_challenge");
}

export async function loadFriendGameChallenge(
  supabase: SupabaseClient,
  challengeId: string
): Promise<FriendGameChallenge | null> {
  const { data, error } = await supabase.rpc("get_friend_game_challenge", {
    p_challenge_id: challengeId,
  });

  if (error) {
    if (isMissingChallengeSchema(error.message)) return null;
    throw error;
  }

  if (!data) return null;
  return mapChallenge(data as RawChallenge);
}

export function opponentDisplayName(challenge: FriendGameChallenge): string {
  const opponent =
    challenge.yourRole === "challenger" ? challenge.challenged : challenge.challenger;
  return getDisplayName(opponent) ?? "Friend";
}

export function opponentProfile(challenge: FriendGameChallenge): ChallengeParticipant {
  return challenge.yourRole === "challenger" ? challenge.challenged : challenge.challenger;
}

export function canPlayChallenge(challenge: FriendGameChallenge): boolean {
  if (challenge.status === "completed" || challenge.status === "cancelled") return false;
  if (challenge.yourRole === "challenger" && challenge.status === "challenger_playing") {
    return true;
  }
  if (challenge.yourRole === "challenged" && challenge.status === "awaiting_friend") {
    return true;
  }
  return false;
}

export function challengerDisplayName(challenge: FriendGameChallenge): string {
  return getDisplayName(challenge.challenger) ?? "Challenger";
}

export function challengedDisplayName(challenge: FriendGameChallenge): string {
  return getDisplayName(challenge.challenged) ?? "Friend";
}
