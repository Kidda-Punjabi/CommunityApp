import type { SupabaseClient } from "@supabase/supabase-js";
import {
  advanceMasteryAfterPass,
  computeStageFills,
  decodeMasteryUnits,
  isFullyMastered,
  isSequenceCompleteFromUnits,
  masteryUnits,
  type TopicStageFills,
  type TopicStageId,
  STAGE_DEPTH_MAX,
} from "@/lib/free-lessons/stages";

export type TopicMasteryRow = {
  lesson_id: string;
  /** Current stage being worked (1–3). */
  stage: TopicStageId;
  /** Levels cleared in the current stage (0–5). */
  depth: number;
  progress_percent: number;
  /** Flat units 0–15 for unlock math. */
  mastery_level: number;
};

export type RecordTopicActivityResult = {
  stage: TopicStageId;
  depth: number;
  progressPercent: number;
  masteryLevel: number;
  leveledUp: boolean;
  stageCleared: boolean;
  mastered: boolean;
  fills: TopicStageFills;
};

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function clampUnits(value: number): number {
  return Math.max(0, Math.min(STAGE_DEPTH_MAX * 3, Math.round(value)));
}

function mapTopicMasteryDbRow(row: {
  lesson_id: string;
  mastery_level?: number | null;
  progress_percent?: number | null;
  stage?: number | null;
  depth?: number | null;
}): TopicMasteryRow {
  if (row.stage != null && row.depth != null) {
    const stage = Math.max(1, Math.min(3, Number(row.stage))) as TopicStageId;
    const depth = Math.max(0, Math.min(STAGE_DEPTH_MAX, Number(row.depth)));
    return {
      lesson_id: row.lesson_id,
      stage,
      depth,
      progress_percent: clampPercent(row.progress_percent ?? 0),
      mastery_level: masteryUnits(stage, depth),
    };
  }

  // Legacy rows without stage/depth: mastery_level held flat units 0–15
  // (older code sometimes clamped to 0–5 vocab-only depth).
  const units = clampUnits(Number(row.mastery_level ?? 0));
  const { stage, depth } = decodeMasteryUnits(units);
  return {
    lesson_id: row.lesson_id,
    stage,
    depth,
    progress_percent: clampPercent(row.progress_percent ?? 0),
    mastery_level: masteryUnits(stage, depth),
  };
}

export async function fetchTopicMasteryMap(
  supabase: SupabaseClient,
  userId: string,
  lessonIds: string[]
): Promise<Map<string, TopicMasteryRow>> {
  if (lessonIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("topic_mastery")
    .select("lesson_id, mastery_level, progress_percent, stage, depth")
    .eq("user_id", userId)
    .in("lesson_id", lessonIds);

  if (error) {
    console.warn("[topic_mastery] fetch failed:", error.message);
    throw error;
  }

  return new Map(
    (data ?? []).map((row) => [row.lesson_id, mapTopicMasteryDbRow(row)])
  );
}

export function ringProgressPercent(mastery: TopicMasteryRow | undefined): number {
  if (!mastery) return 0;
  const fills = computeStageFills(
    mastery.stage,
    mastery.depth,
    mastery.progress_percent
  );
  return Math.round((fills.vocab + fills.sentences + fills.conversation) / 3);
}

export function stageFillsForMastery(
  mastery: TopicMasteryRow | undefined
): TopicStageFills {
  if (!mastery) return { vocab: 0, sentences: 0, conversation: 0 };
  return computeStageFills(mastery.stage, mastery.depth, mastery.progress_percent);
}

export async function recordTopicActivityResult(
  supabase: SupabaseClient,
  userId: string,
  lessonId: string,
  passed: boolean,
  scorePercent: number
): Promise<RecordTopicActivityResult> {
  const existingMap = await fetchTopicMasteryMap(supabase, userId, [lessonId]);
  const existing = existingMap.get(lessonId);

  let stage: TopicStageId = existing?.stage ?? 1;
  let depth = existing?.depth ?? 0;
  let progressPercent = existing?.progress_percent ?? 0;
  let leveledUp = false;
  let stageCleared = false;

  if (isFullyMastered(stage, depth)) {
    return {
      stage: 3,
      depth: STAGE_DEPTH_MAX,
      progressPercent: 100,
      masteryLevel: masteryUnits(3, STAGE_DEPTH_MAX),
      leveledUp: false,
      stageCleared: false,
      mastered: true,
      fills: computeStageFills(3, STAGE_DEPTH_MAX, 100),
    };
  }

  if (passed) {
    const advanced = advanceMasteryAfterPass(stage, depth);
    stage = advanced.stage;
    depth = advanced.depth;
    progressPercent = isFullyMastered(stage, depth) ? 100 : 0;
    leveledUp = advanced.leveledUp;
    stageCleared = advanced.stageCleared;
  } else {
    progressPercent = Math.min(
      90,
      Math.max(progressPercent, Math.round(scorePercent * 0.7))
    );
  }

  const units = clampUnits(masteryUnits(stage, depth));
  const payload = {
    user_id: userId,
    lesson_id: lessonId,
    mastery_level: units,
    progress_percent: progressPercent,
    stage,
    depth,
  };

  const { error } = await supabase
    .from("topic_mastery")
    .upsert(payload, { onConflict: "user_id,lesson_id" });

  if (error) throw error;

  return {
    stage,
    depth,
    progressPercent,
    masteryLevel: units,
    leveledUp,
    stageCleared,
    mastered: isFullyMastered(stage, depth),
    fills: computeStageFills(stage, depth, progressPercent),
  };
}

export { isSequenceCompleteFromUnits, isFullyMastered, masteryUnits };
