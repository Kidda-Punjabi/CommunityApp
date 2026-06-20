import type { GameType } from "@/lib/games/types";
import type { GameSessionSettingsChoice } from "@/lib/games/session-settings";

export type ChallengeStatus = "challenger_playing" | "awaiting_friend" | "completed" | "cancelled";

export type StreakSurvivalVariant = "foundational" | "gender" | "verbs" | "deck";

export type ChallengeDeckConfig = {
  lessonId: string;
  deckId: string;
  deckName: string;
};

export type ChallengeConfig = {
  seed: number;
  session?: GameSessionSettingsChoice;
  deck?: ChallengeDeckConfig;
  streakVariant?: StreakSurvivalVariant;
};

export type ChallengeParticipant = {
  id: string;
  full_name: string | null;
  preferred_name: string | null;
  avatar_url: string | null;
};

export type FriendGameChallenge = {
  id: string;
  gameType: GameType;
  config: ChallengeConfig;
  status: ChallengeStatus;
  challengerId: string;
  challengedId: string;
  challengerScore: number | null;
  challengedScore: number | null;
  challengerScoreMetadata: Record<string, unknown>;
  challengedScoreMetadata: Record<string, unknown>;
  winnerId: string | null;
  isTie: boolean;
  yourRole: "challenger" | "challenged";
  challenger: ChallengeParticipant;
  challenged: ChallengeParticipant;
  createdAt: string;
  completedAt: string | null;
};

export type ChallengeSubmitResult = {
  status: ChallengeStatus;
  role: "challenger" | "challenged";
  yourScore: number;
  winnerId?: string | null;
  isTie?: boolean;
  challengerScore?: number;
};

export type ChallengePlayContext = {
  id: string;
  role: "challenger" | "challenged";
  config: ChallengeConfig;
  opponentDisplayName: string;
  status: ChallengeStatus;
};
