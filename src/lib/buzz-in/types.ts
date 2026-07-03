import type { McqQuestionPayload } from "@/lib/group-games/buzz-race-types";

export type BuzzInQuestionPayload = McqQuestionPayload;

export type BuzzInRoundRow = {
  id: string;
  room_id: string;
  round_number: number;
  question_payload: McqQuestionPayload;
  opened_at: string | null;
  buzzed_by: string | null;
  buzzed_at: string | null;
  answer_given: string | null;
  answer_correct: boolean | null;
  resolved_at: string | null;
  created_at: string;
};

export type BuzzInScoreboardEntry = {
  userId: string;
  displayName: string;
  score: number;
  isPlaying: boolean;
  isHost: boolean;
};

export type BuzzInGameState = {
  roomId: string;
  currentRoundNumber: number;
  totalRounds: number;
  currentRound: BuzzInRoundRow | null;
  scoreboard: BuzzInScoreboardEntry[];
  roomStatus: "in_progress" | "completed" | "cancelled";
  currentUserId: string;
  isPlaying: boolean;
};

export type BuzzInPhase = "waiting" | "open" | "buzzed" | "result" | "finished";
