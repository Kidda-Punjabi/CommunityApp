export const AUDIO_ASSET_STATUSES = [
  "none",
  "pending_review",
  "approved",
  "needs_changes",
] as const;

export type AudioAssetStatus = (typeof AUDIO_ASSET_STATUSES)[number];

export type AudioGenerationStatus = "pending_review" | "approved" | "rejected";

export type AudioContentType =
  | "lesson"
  | "lesson_segment_beat"
  | "flashcard"
  | "flashcard_example"
  | "comprehension_sentence"
  | "conversation_turn"
  | "conversation_exchange_npc_setup"
  | "conversation_exchange_npc_reply"
  | "conversation_exchange_player_response";

export type AudioAsset = {
  id: string;
  content_type: AudioContentType;
  content_id: string;
  script_text: string | null;
  storage_path: string | null;
  audio_url: string | null;
  status: AudioAssetStatus;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AudioGeneration = {
  id: string;
  audio_asset_id: string;
  script_text: string;
  storage_path: string;
  status: AudioGenerationStatus;
  review_notes: string | null;
  reviewed_by: string | null;
  created_at: string;
  reviewed_at: string | null;
  voice_id: string | null;
  variation_index: number;
  generation_batch_id: string | null;
};

export const AUDIO_ASSET_STATUS_LABELS: Record<AudioAssetStatus, string> = {
  none: "None",
  pending_review: "Pending review",
  approved: "Approved",
  needs_changes: "Needs changes",
};

export const AUDIO_CONTENT_TYPE_LABELS: Record<AudioContentType, string> = {
  lesson: "Lesson",
  lesson_segment_beat: "Catch-up beat",
  flashcard: "Flashcard",
  flashcard_example: "Flashcard example",
  comprehension_sentence: "Comprehension Practice",
  conversation_turn: "Conversation Turn",
  conversation_exchange_npc_setup: "Conversation — NPC setup",
  conversation_exchange_npc_reply: "Conversation — NPC reply",
  conversation_exchange_player_response: "Conversation — Player response",
};

export const CONVERSATION_EXCHANGE_AUDIO_CONTENT_TYPES = [
  "conversation_exchange_npc_setup",
  "conversation_exchange_npc_reply",
  "conversation_exchange_player_response",
] as const satisfies readonly AudioContentType[];

export function audioAssetStatusBadgeClass(status: AudioAssetStatus): string {
  switch (status) {
    case "approved":
      return "bg-emerald-50 text-emerald-700";
    case "pending_review":
      return "bg-amber-50 text-amber-800";
    case "needs_changes":
      return "bg-rose-50 text-rose-700";
    default:
      return "bg-zinc-100 text-zinc-600";
  }
}

/** @deprecated Use audio types from @/lib/audio/types */
export type LessonAudioStatus = AudioAssetStatus;
export type LessonAudioGenerationStatus = AudioGenerationStatus;
export type LessonAudioGeneration = AudioGeneration & { lesson_id?: string };

export const LESSON_AUDIO_STATUSES = AUDIO_ASSET_STATUSES;
export const LESSON_AUDIO_STATUS_LABELS = AUDIO_ASSET_STATUS_LABELS;
export const lessonAudioStatusBadgeClass = audioAssetStatusBadgeClass;
