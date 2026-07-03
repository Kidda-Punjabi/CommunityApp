import type { McqQuestionPayload } from "@/lib/group-games/buzz-race-types";

export type RaceStateRow = {
  id: string;
  room_id: string;
  player_id: string;
  current_question_payload: McqQuestionPayload;
  score: number;
  questions_answered: number;
  is_winner: boolean;
  updated_at: string;
  created_at: string;
};

export type RaceStanding = {
  playerId: string;
  displayName: string;
  score: number;
  questionsAnswered: number;
  isWinner: boolean;
};

export type PointRaceGameState = {
  roomId: string;
  myRaceState: RaceStateRow | null;
  standings: RaceStanding[];
  winScore: number;
  winnerId: string | null;
  roomStatus: "in_progress" | "completed" | "cancelled";
  currentUserId: string;
  isPlaying: boolean;
};
