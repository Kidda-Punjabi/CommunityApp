import type {
  CatchupBeat,
  CatchupLesson,
  CatchupPhraseSourceType,
  CatchupSegment,
} from "@/lib/catchup/types";
import { parseTeachingVisual } from "@/lib/catchup/teaching-visuals/types";
import type { AudioAssetStatus } from "@/lib/audio/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type SegmentRow = {
  id: string;
  segment_number: number;
  sort_order: number;
  title: string;
  teaching_visual_type: string | null;
  teaching_visual_config: unknown;
  activity_type: CatchupSegment["activityType"];
  activity_ref_id: string | null;
  activity_instructions: string | null;
  homework_submission_type?: CatchupSegment["homeworkSubmissionType"] | null;
};

type BeatRow = {
  id: string;
  segment_id: string;
  beat_number: number;
  beat_type: "narration" | "phrase_reference";
  script_text: string | null;
  source_content_type: string | null;
  source_content_id: string | null;
};

type FlashcardRow = {
  id: string;
  front_text: string;
  back_text: string;
};

function beatAudioStatus(status: string | null | undefined): AudioAssetStatus {
  if (
    status === "approved" ||
    status === "pending_review" ||
    status === "needs_changes" ||
    status === "none"
  ) {
    return status;
  }
  return "none";
}

export async function loadCatchupLesson(
  supabase: SupabaseClient,
  userId: string,
  lessonId: string
): Promise<CatchupLesson | null> {
  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("id, title, lesson_number, courses(name)")
    .eq("id", lessonId)
    .maybeSingle();

  if (lessonError) throw lessonError;
  if (!lesson) return null;

  const course = Array.isArray(lesson.courses) ? lesson.courses[0] : lesson.courses;

  const { data: segmentRows, error: segmentError } = await supabase
    .from("lesson_segments")
    .select(
      "id, segment_number, sort_order, title, teaching_visual_type, teaching_visual_config, activity_type, activity_ref_id, activity_instructions, homework_submission_type"
    )
    .eq("lesson_id", lessonId)
    .order("sort_order", { ascending: true });

  if (segmentError) throw segmentError;

  const segments = (segmentRows ?? []) as SegmentRow[];
  if (segments.length === 0) {
    return {
      lessonId,
      lessonTitle: lesson.title,
      lessonNumber: lesson.lesson_number,
      courseName: course?.name ?? "Course",
      segments: [],
    };
  }

  const segmentIds = segments.map((row) => row.id);

  const [{ data: beatRows }, { data: progressRows }] = await Promise.all([
    supabase
      .from("lesson_segment_beats")
      .select("id, segment_id, beat_number, beat_type, script_text, source_content_type, source_content_id")
      .in("segment_id", segmentIds)
      .order("beat_number", { ascending: true }),
    supabase
      .from("lesson_segment_progress")
      .select("segment_id")
      .eq("user_id", userId)
      .in("segment_id", segmentIds),
  ]);

  const beats = (beatRows ?? []) as BeatRow[];
  const completedSegmentIds = new Set((progressRows ?? []).map((row) => row.segment_id));

  const narrationBeatIds = beats
    .filter((beat) => beat.beat_type === "narration")
    .map((beat) => beat.id);

  const phraseFlashcardIds = beats
    .filter((beat) => beat.beat_type === "phrase_reference" && beat.source_content_type === "flashcard")
    .map((beat) => beat.source_content_id)
    .filter(Boolean) as string[];

  const audioContentIds = [...narrationBeatIds, ...phraseFlashcardIds];

  const [{ data: narrationAssets }, { data: phraseAssets }, { data: flashcards }] =
    await Promise.all([
      narrationBeatIds.length > 0
        ? supabase
            .from("audio_assets")
            .select("content_id, status, audio_url, storage_path")
            .eq("content_type", "lesson_segment_beat")
            .in("content_id", narrationBeatIds)
        : Promise.resolve({ data: [] as { content_id: string; status: string; audio_url: string | null; storage_path: string | null }[] }),
      phraseFlashcardIds.length > 0
        ? supabase
            .from("audio_assets")
            .select("content_type, content_id, status, audio_url, storage_path")
            .eq("content_type", "flashcard")
            .in("content_id", phraseFlashcardIds)
        : Promise.resolve({ data: [] as { content_type: string; content_id: string; status: string; audio_url: string | null; storage_path: string | null }[] }),
      phraseFlashcardIds.length > 0
        ? supabase
            .from("flashcards")
            .select("id, front_text, back_text")
            .in("id", phraseFlashcardIds)
        : Promise.resolve({ data: [] as FlashcardRow[] }),
    ]);

  const narrationAssetByBeatId = new Map(
    (narrationAssets ?? []).map((asset) => [asset.content_id, asset])
  );
  const phraseAssetByFlashcardId = new Map(
    (phraseAssets ?? []).map((asset) => [asset.content_id, asset])
  );
  const flashcardById = new Map((flashcards ?? []).map((card) => [card.id, card]));

  const beatsBySegment = new Map<string, CatchupBeat[]>();
  for (const beat of beats) {
    const list = beatsBySegment.get(beat.segment_id) ?? [];

    if (beat.beat_type === "narration") {
      const asset = narrationAssetByBeatId.get(beat.id);
      list.push({
        id: beat.id,
        beatNumber: beat.beat_number,
        beatType: "narration",
        scriptText: beat.script_text,
        sourceContentType: null,
        sourceContentId: null,
        audioUrl:
          asset?.status === "approved" ? (asset.audio_url?.trim() || null) : null,
        audioStatus: beatAudioStatus(asset?.status),
        phraseLabel: null,
        phraseTranslation: null,
      });
    } else {
      const flashcard = beat.source_content_id
        ? flashcardById.get(beat.source_content_id)
        : null;
      const asset = beat.source_content_id
        ? phraseAssetByFlashcardId.get(beat.source_content_id)
        : null;

      list.push({
        id: beat.id,
        beatNumber: beat.beat_number,
        beatType: "phrase_reference",
        scriptText: null,
        sourceContentType: (beat.source_content_type as CatchupPhraseSourceType) ?? null,
        sourceContentId: beat.source_content_id,
        audioUrl:
          asset?.status === "approved" ? (asset.audio_url?.trim() || null) : null,
        audioStatus: beatAudioStatus(asset?.status),
        phraseLabel: flashcard?.front_text ?? null,
        phraseTranslation: flashcard?.back_text ?? null,
      });
    }

    beatsBySegment.set(beat.segment_id, list);
  }

  const mappedSegments: CatchupSegment[] = segments.map((row) => ({
    id: row.id,
    segmentNumber: row.segment_number,
    sortOrder: row.sort_order,
    title: row.title,
    teachingVisual: parseTeachingVisual(
      row.teaching_visual_type,
      row.teaching_visual_config
    ),
    activityType: row.activity_type,
    activityRefId: row.activity_ref_id,
    activityInstructions: row.activity_instructions,
    homeworkSubmissionType:
      row.homework_submission_type === "text" ? "text" : "voice",
    beats: beatsBySegment.get(row.id) ?? [],
    completed: completedSegmentIds.has(row.id),
  }));

  return {
    lessonId,
    lessonTitle: lesson.title,
    lessonNumber: lesson.lesson_number,
    courseName: course?.name ?? "Course",
    segments: mappedSegments,
  };
}

export async function markCatchupSegmentComplete(
  supabase: SupabaseClient,
  userId: string,
  segmentId: string
): Promise<void> {
  const { error } = await supabase.from("lesson_segment_progress").upsert(
    {
      user_id: userId,
      segment_id: segmentId,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,segment_id" }
  );
  if (error) throw error;
}

/** Lesson IDs that have at least one catch-up segment configured. */
export async function fetchCatchupEnabledLessonIds(
  supabase: SupabaseClient,
  lessonIds: string[]
): Promise<Set<string>> {
  if (lessonIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from("lesson_segments")
    .select("lesson_id")
    .in("lesson_id", lessonIds);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.lesson_id));
}
