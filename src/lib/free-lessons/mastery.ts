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
  /** Legacy flat units 0–15 for unlock math. */
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

function isMissingTableError(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes("topic_mastery") ||
    message.includes("schema cache") ||
    message.includes("does not exist")
  );
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function rowFromUnits(
  lessonId: string,
  units: number,
  progressPercent: number
): TopicMasteryRow {
  const { stage, depth } = decodeMasteryUnits(units);
  return {
    lesson_id: lessonId,
    stage,
    depth,
    progress_percent:
      isFullyMastered(stage, depth) ? 100 : clampPercent(progressPercent),
    mastery_level: masteryUnits(stage, depth),
  };
}

async function fetchFromLessonProgressFallback(
  supabase: SupabaseClient,
  userId: string,
  lessonIds: string[]
): Promise<Map<string, TopicMasteryRow>> {
  const { data } = await supabase
    .from("lesson_progress")
    .select(
      "lesson_id, completed, last_position, seconds_listened, last_page_viewed, total_pages"
    )
    .eq("user_id", userId)
    .in("lesson_id", lessonIds);

  return new Map(
    (data ?? []).map((row) => {
      // Prefer last_page_viewed as units (0–15). Legacy: last_position 0–5 mapped into vocab stage.
      let units = 0;
      if (row.last_page_viewed != null && Number(row.last_page_viewed) > 0) {
        units = Math.min(15, Math.max(0, Number(row.last_page_viewed)));
      } else if (
        row.last_position != null &&
        Number(row.last_position) > 0 &&
        Number(row.last_position) <= 5
      ) {
        units = Number(row.last_position);
      } else if (row.completed) {
        units = 1;
      }

      const progressPercent = clampPercent(
        row.total_pages != null && Number(row.total_pages) >= 0
          ? Number(row.total_pages)
          : 0
      );

      return [row.lesson_id, rowFromUnits(row.lesson_id, units, progressPercent)];
    })
  );
}

async function saveLessonProgressFallback(
  supabase: SupabaseClient,
  userId: string,
  lessonId: string,
  units: number,
  progressPercent: number
): Promise<void> {
  const { data: existing } = await supabase
    .from("lesson_progress")
    .select("seconds_listened, last_position")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  const { error } = await supabase.from("lesson_progress").upsert(
    {
      user_id: userId,
      lesson_id: lessonId,
      completed: units >= 1,
      last_position: existing?.last_position ?? 0,
      seconds_listened: existing?.seconds_listened ?? 0,
      last_page_viewed: units,
      total_pages: progressPercent,
      pdf_completed: units >= STAGE_DEPTH_MAX * 3,
    },
    { onConflict: "user_id,lesson_id" }
  );
  if (error) throw error;
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

  // Old schema: mastery_level 0–5 treated as vocab-stage depth.
  const legacy = Math.max(0, Math.min(5, Number(row.mastery_level ?? 0)));
  return rowFromUnits(row.lesson_id, legacy, row.progress_percent ?? 0);
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
    if (isMissingTableError(error.message) || error.message.includes("stage")) {
      // Missing table, or table exists without stage/depth columns yet.
      if (isMissingTableError(error.message)) {
        return fetchFromLessonProgressFallback(supabase, userId, lessonIds);
      }
      const { data: legacy } = await supabase
        .from("topic_mastery")
        .select("lesson_id, mastery_level, progress_percent")
        .eq("user_id", userId)
        .in("lesson_id", lessonIds);
      return new Map(
        (legacy ?? []).map((row) => [
          row.lesson_id,
          mapTopicMasteryDbRow(row),
        ])
      );
    }
    console.warn("[topic_mastery] fetch failed:", error.message);
    return new Map();
  }

  const map = new Map(
    (data ?? []).map((row) => [row.lesson_id, mapTopicMasteryDbRow(row)])
  );

  const missing = lessonIds.filter((id) => !map.has(id));
  if (missing.length > 0) {
    const fallback = await fetchFromLessonProgressFallback(supabase, userId, missing);
    for (const [id, row] of fallback) {
      if (row.mastery_level > 0 || row.progress_percent > 0) {
        map.set(id, row);
      }
    }
  }

  return map;
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

  const units = masteryUnits(stage, depth);
  const payload = {
    user_id: userId,
    lesson_id: lessonId,
    mastery_level: Math.min(5, units), // keep check-friendly if old constraint exists
    progress_percent: progressPercent,
    stage,
    depth,
  };

  const { error } = await supabase
    .from("topic_mastery")
    .upsert(payload, { onConflict: "user_id,lesson_id" });

  if (error) {
    if (isMissingTableError(error.message) || error.message.includes("stage")) {
      // Fall back: store units in lesson_progress; try mastery_level-only upsert if table exists.
      if (!isMissingTableError(error.message)) {
        await supabase.from("topic_mastery").upsert(
          {
            user_id: userId,
            lesson_id: lessonId,
            mastery_level: Math.min(5, Math.max(units, 1)),
            progress_percent: progressPercent,
          },
          { onConflict: "user_id,lesson_id" }
        );
      }
      await saveLessonProgressFallback(
        supabase,
        userId,
        lessonId,
        units,
        progressPercent
      );
    } else {
      throw error;
    }
  } else {
    // Also mirror units into lesson_progress for resilient reads.
    await saveLessonProgressFallback(
      supabase,
      userId,
      lessonId,
      units,
      progressPercent
    ).catch(() => {
      /* non-fatal */
    });
  }

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
