import type { SupabaseClient } from "@supabase/supabase-js";
import { TOPIC_MASTERY_MAX_LEVEL } from "@/lib/free-lessons/topic-visuals";

export type TopicMasteryRow = {
  lesson_id: string;
  mastery_level: number;
  progress_percent: number;
};

export type RecordTopicActivityResult = {
  masteryLevel: number;
  progressPercent: number;
  leveledUp: boolean;
  mastered: boolean;
};

/**
 * Fallback encoding on lesson_progress when topic_mastery is absent:
 * - last_page_viewed = mastery_level (0–5)
 * - total_pages = progress_percent (0–100)
 * - completed = mastery_level >= 1 (sequence complete)
 *
 * Avoids last_position / seconds_listened, which lesson audio/PDF tracking uses.
 */
function isMissingTableError(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes("topic_mastery") ||
    message.includes("schema cache") ||
    message.includes("does not exist")
  );
}

function clampLevel(value: number): number {
  return Math.max(0, Math.min(TOPIC_MASTERY_MAX_LEVEL, Math.round(value)));
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
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
      // Prefer dedicated page fields; fall back to older last_position encoding.
      const fromPages =
        row.last_page_viewed != null && Number(row.last_page_viewed) > 0
          ? Number(row.last_page_viewed)
          : null;
      const fromLegacy =
        row.last_position != null &&
        Number(row.last_position) >= 0 &&
        Number(row.last_position) <= TOPIC_MASTERY_MAX_LEVEL
          ? Number(row.last_position)
          : null;

      let masteryLevel = clampLevel(fromPages ?? fromLegacy ?? 0);
      if (row.completed && masteryLevel < 1) masteryLevel = 1;

      const progressPercent = clampPercent(
        row.total_pages != null && Number(row.total_pages) >= 0
          ? Number(row.total_pages)
          : row.seconds_listened != null &&
              Number(row.seconds_listened) >= 0 &&
              Number(row.seconds_listened) <= 100
            ? Number(row.seconds_listened)
            : 0
      );

      return [
        row.lesson_id,
        {
          lesson_id: row.lesson_id,
          mastery_level: masteryLevel,
          progress_percent:
            masteryLevel >= TOPIC_MASTERY_MAX_LEVEL ? 100 : progressPercent,
        },
      ];
    })
  );
}

async function saveLessonProgressFallback(
  supabase: SupabaseClient,
  userId: string,
  lessonId: string,
  masteryLevel: number,
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
      completed: masteryLevel >= 1,
      // Preserve audio fields if already set; only write mastery into page fields.
      last_position: existing?.last_position ?? 0,
      seconds_listened: existing?.seconds_listened ?? 0,
      last_page_viewed: masteryLevel,
      total_pages: progressPercent,
      pdf_completed: masteryLevel >= TOPIC_MASTERY_MAX_LEVEL,
    },
    { onConflict: "user_id,lesson_id" }
  );
  if (error) throw error;
}

export async function fetchTopicMasteryMap(
  supabase: SupabaseClient,
  userId: string,
  lessonIds: string[]
): Promise<Map<string, TopicMasteryRow>> {
  if (lessonIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("topic_mastery")
    .select("lesson_id, mastery_level, progress_percent")
    .eq("user_id", userId)
    .in("lesson_id", lessonIds);

  if (error) {
    if (isMissingTableError(error.message)) {
      return fetchFromLessonProgressFallback(supabase, userId, lessonIds);
    }
    console.warn("[topic_mastery] fetch failed:", error.message);
    return new Map();
  }

  // Table exists but may be empty while older progress lives in lesson_progress —
  // merge fallback for any lesson still missing a mastery row.
  const map = new Map(
    (data ?? []).map((row) => [
      row.lesson_id,
      {
        lesson_id: row.lesson_id,
        mastery_level: row.mastery_level ?? 0,
        progress_percent: row.progress_percent ?? 0,
      } satisfies TopicMasteryRow,
    ])
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
  if (mastery.mastery_level >= TOPIC_MASTERY_MAX_LEVEL) return 100;
  // Show at least a sliver once sequence-complete so the path doesn't look empty.
  if (mastery.mastery_level > 0 && mastery.progress_percent === 0) {
    return Math.round((mastery.mastery_level / TOPIC_MASTERY_MAX_LEVEL) * 100);
  }
  return Math.max(0, Math.min(100, mastery.progress_percent));
}

/**
 * Passing an activity fills the ring and advances one mastery level.
 * Failing still awards partial ring progress.
 */
export async function recordTopicActivityResult(
  supabase: SupabaseClient,
  userId: string,
  lessonId: string,
  passed: boolean,
  scorePercent: number
): Promise<RecordTopicActivityResult> {
  const existingMap = await fetchTopicMasteryMap(supabase, userId, [lessonId]);
  const existing = existingMap.get(lessonId);

  let masteryLevel = existing?.mastery_level ?? 0;
  let progressPercent = existing?.progress_percent ?? 0;
  let leveledUp = false;

  if (masteryLevel >= TOPIC_MASTERY_MAX_LEVEL) {
    return {
      masteryLevel,
      progressPercent: 100,
      leveledUp: false,
      mastered: true,
    };
  }

  if (passed) {
    masteryLevel = Math.min(TOPIC_MASTERY_MAX_LEVEL, masteryLevel + 1);
    progressPercent = masteryLevel >= TOPIC_MASTERY_MAX_LEVEL ? 100 : 0;
    leveledUp = true;
  } else {
    progressPercent = Math.min(
      90,
      Math.max(progressPercent, Math.round(scorePercent * 0.7))
    );
  }

  const { error } = await supabase.from("topic_mastery").upsert(
    {
      user_id: userId,
      lesson_id: lessonId,
      mastery_level: masteryLevel,
      progress_percent: progressPercent,
    },
    { onConflict: "user_id,lesson_id" }
  );

  if (error) {
    if (isMissingTableError(error.message)) {
      await saveLessonProgressFallback(
        supabase,
        userId,
        lessonId,
        masteryLevel,
        progressPercent
      );
    } else {
      throw error;
    }
  }

  return {
    masteryLevel,
    progressPercent,
    leveledUp,
    mastered: masteryLevel >= TOPIC_MASTERY_MAX_LEVEL,
  };
}
