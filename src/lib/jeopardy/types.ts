import type { McqQuestionPayload } from "@/lib/group-games/buzz-race-types";
import type { JeopardyCategory } from "@/lib/jeopardy/constants";

export type JeopardyTileStatus = "unopened" | "active" | "resolved";

export type JeopardyTileRow = {
  id: string;
  room_id: string;
  category: JeopardyCategory;
  point_value: number;
  flashcard_id: string | null;
  question_payload: McqQuestionPayload | null;
  status: JeopardyTileStatus;
  opened_at: string | null;
  buzzed_by: string | null;
  buzzed_at: string | null;
  answer_given: string | null;
  answer_correct: boolean | null;
  resolved_at: string | null;
  created_at: string;
};

export type JeopardyScoreboardEntry = {
  userId: string;
  displayName: string;
  score: number;
  isPlaying: boolean;
  isHost: boolean;
};

export type SkippedTileInfo = {
  category: string;
  point_value: number;
  difficulty: number;
  reason: string;
};

export type JeopardyGameState = {
  roomId: string;
  tiles: JeopardyTileRow[];
  activeTile: JeopardyTileRow | null;
  currentPickerId: string | null;
  skippedTiles: SkippedTileInfo[];
  scoreboard: JeopardyScoreboardEntry[];
  roomStatus: "in_progress" | "completed" | "cancelled";
  currentUserId: string;
  isPlaying: boolean;
};

export type JeopardyViewMode = "board" | "question" | "result";
