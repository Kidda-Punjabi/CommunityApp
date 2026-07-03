import type { LadderQuestionPayload } from "@/lib/chado-pauri-group/ladder-questions";

export type LadderRunStatus = "pending" | "active" | "completed";

export type LadderRunRow = {
  id: string;
  room_id: string;
  player_id: string;
  turn_order: number;
  status: LadderRunStatus;
  current_rung: number;
  final_score: number | null;
  half_half_used: boolean;
  ask_tutor_used: boolean;
  ask_room_used: boolean;
  tutor_hint: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
};

export type LadderQuestionRow = {
  id: string;
  run_id: string;
  rung: number;
  question_payload: LadderQuestionPayload;
  eliminated_options: string[] | null;
  ask_room_opened_at: string | null;
  room_vote_tally: Record<string, number> | null;
  answer_given: string | null;
  answer_correct: boolean | null;
  resolved_at: string | null;
  created_at: string;
};

export type LadderVoteRow = {
  id: string;
  question_id: string;
  voter_id: string;
  selected_option: string;
  created_at: string;
};

export type LadderScoreboardEntry = {
  userId: string;
  displayName: string;
  score: number;
  isPlaying: boolean;
  isHost: boolean;
};

export type LadderGameState = {
  roomId: string;
  runs: LadderRunRow[];
  activeRun: LadderRunRow | null;
  currentQuestion: LadderQuestionRow | null;
  scoreboard: LadderScoreboardEntry[];
  roomStatus: "in_progress" | "completed" | "cancelled";
  currentUserId: string;
  isPlaying: boolean;
};
