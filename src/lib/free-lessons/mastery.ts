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

function isMissingTableError(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes("topic_mastery") ||
    message.includes("schema cache") ||
    message.includes("does not exist")
  );
}

async function fetchFromLessonProgressFallback(
  supabase: SupabaseClient,
  userId: string,
  lessonIds: string[]
): Promise<Map<string, TopicMasteryRow>> {
  const { data } = await supabase
    .from("lesson_progress")
    .select("lesson_id, completed, last_position, seconds_listened")
    .eq("user_id", userId)
    .in("lesson_id", lessonIds);

  return new Map(
    (data ?? []).map((row) => {
      const masteryLevel = Math.max(
        0,
        Math.min(
          TOPIC_MASTERY_MAX_LEVEL,
          row.completed
            ? TOPIC_MASTERY_MAX_LEVEL
            : Math.round(row.last_position ?? 0)
        )
      );
      const progressPercent = Math.max(
        0,
        Math.min(100, Math.round(row.seconds_listened ?? 0))
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
  const { error } = await supabase.from("lesson_progress").upsert(
    {
      user_id: userId,
      lesson_id: lessonId,
      completed: masteryLevel >= TOPIC_MASTERY_MAX_LEVEL,
      last_position: masteryLevel,
      seconds_listened: progressPercent,
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

  return new Map(
    (data ?? []).map((row) => [
      row.lesson_id,
      {
        lesson_id: row.lesson_id,
        mastery_level: row.mastery_level ?? 0,
        progress_percent: row.progress_percent ?? 0,
      },
    ])
  );
}

export function ringProgressPercent(mastery: TopicMasteryRow | undefined): number {
  if (!mastery) return 0;
  if (mastery.mastery_level >= TOPIC_MASTERY_MAX_LEVEL) return 100;
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
