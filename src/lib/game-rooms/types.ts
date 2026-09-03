export type GroupGameType =
  | "buzz_in"
  | "jeopardy"
  | "chado_pauri_group"
  | "sentence_builder_group"
  | "point_race"
  | "sound_match_group"
  | "vowel_match_group";

export type GameRoomStatus = "lobby" | "in_progress" | "completed" | "cancelled";

export type GameRoomSettings = {
  question_count?: number;
  /** Host-selected flashcard/grammar topic tags (lowercase). */
  topic_tags?: string[];
  /** Inclusive difficulty floor (1–5) for filtered group games. */
  difficulty_min?: number;
  /** Inclusive difficulty ceiling (1–5) for filtered group games. */
  difficulty_max?: number;
  [key: string]: unknown;
};

export type GameRoomRow = {
  id: string;
  host_id: string;
  game_type: GroupGameType;
  join_code: string;
  status: GameRoomStatus;
  settings: GameRoomSettings;
  current_picker_id: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
};

export type GameRoomParticipantRow = {
  id: string;
  room_id: string;
  user_id: string;
  is_host: boolean;
  is_playing: boolean;
  score: number;
  joined_at: string;
  left_at: string | null;
};

export type GameRoomParticipantView = {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isHost: boolean;
  isPlaying: boolean;
};

export type GameRoomView = {
  room: GameRoomRow;
  participants: GameRoomParticipantView[];
  currentUserId: string;
  isHost: boolean;
};
