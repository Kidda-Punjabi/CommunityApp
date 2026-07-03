import type {
  GroupSentencePoolTile,
  PlacedSentenceTile,
} from "@/lib/sentence-builder-group/tiles";

export type SentenceRoundStatus = "active" | "completed";

export type SentenceRoundRow = {
  id: string;
  room_id: string;
  round_number: number;
  grammar_sentence_id: string;
  tile_pool: GroupSentencePoolTile[];
  filled_slots: PlacedSentenceTile[];
  current_turn_player_id: string | null;
  status: SentenceRoundStatus;
  started_at: string;
  completed_at: string | null;
  created_at: string;
};

export type SentencePlacementRow = {
  id: string;
  round_id: string;
  player_id: string;
  tile_identifier: string;
  was_correct: boolean;
  created_at: string;
};

export type SentenceScoreboardEntry = {
  userId: string;
  displayName: string;
  score: number;
  isPlaying: boolean;
  isHost: boolean;
};

export type SentenceBuilderGroupState = {
  roomId: string;
  rounds: SentenceRoundRow[];
  activeRound: SentenceRoundRow | null;
  /** Set while waiting for the next round to be created after a completion. */
  latestCompletedRound: SentenceRoundRow | null;
  totalRounds: number;
  /** English translation — only populated when a round has just completed (hidden during active play). */
  revealedTranslation: string | null;
  scoreboard: SentenceScoreboardEntry[];
  roomStatus: "in_progress" | "completed" | "cancelled";
  currentUserId: string;
  isPlaying: boolean;
};
