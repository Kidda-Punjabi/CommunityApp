import type { TeachingVisual } from "@/lib/catchup/teaching-visuals/types";

export type SegmentActivityType =
  | "none"
  | "quiz"
  | "flashcard_set"
  | "game"
  | "homework"
  | "external_link"
  | "fill_blank"
  | "translate"
  | "record_practice";

export type HomeworkSubmissionType = "voice" | "text";

export type SegmentBeatType = "narration" | "phrase_reference";

export type CatchupPhraseSourceType = "flashcard" | "grammar_sentence";

export type CatchupBeat = {
  id: string;
  beatNumber: number;
  beatType: SegmentBeatType;
  scriptText: string | null;
  sourceContentType: CatchupPhraseSourceType | null;
  sourceContentId: string | null;
  /** Approved audio URL — narration from lesson_segment_beat asset, phrase from source asset */
  audioUrl: string | null;
  audioStatus: "none" | "pending_review" | "approved" | "needs_changes";
  /** Display for phrase_reference beats */
  phraseLabel: string | null;
  phraseTranslation: string | null;
};

export type CatchupSegment = {
  id: string;
  segmentNumber: number;
  sortOrder: number;
  title: string;
  teachingVisual: TeachingVisual | null;
  activityType: SegmentActivityType;
  activityRefId: string | null;
  activityInstructions: string | null;
  homeworkSubmissionType: HomeworkSubmissionType;
  beats: CatchupBeat[];
  completed: boolean;
};

export type CatchupLesson = {
  lessonId: string;
  lessonTitle: string;
  lessonNumber: number;
  courseName: string;
  segments: CatchupSegment[];
};

export type CatchupGameRef = {
  slug:
    | "memory-grid"
    | "streak-survival"
    | "conversation-practice"
    | "voice-practice"
    | "speaking-practice";
  lessonId: string;
  deckId?: string;
  segmentId?: string;
};
