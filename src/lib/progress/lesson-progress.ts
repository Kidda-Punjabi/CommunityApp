import type { SupabaseClient } from "@supabase/supabase-js";

export type LessonProgressRow = {
  lesson_id: string;
  completed: boolean;
  seconds_listened: number;
  last_position: number;
};

export async function fetchLessonProgressMap(
  supabase: SupabaseClient,
  userId: string
): Promise<Map<string, LessonProgressRow>> {
  const { data } = await supabase
    .from("lesson_progress")
    .select("lesson_id, completed, seconds_listened, last_position")
    .eq("user_id", userId);

  return new Map((data ?? []).map((row) => [row.lesson_id, row]));
}

export type SaveLessonProgressInput = {
  lessonId: string;
  lastPosition: number;
  secondsListened: number;
  completed: boolean;
};

export async function saveLessonProgress(
  supabase: SupabaseClient,
  userId: string,
  input: SaveLessonProgressInput
) {
  const { error } = await supabase.from("lesson_progress").upsert(
    {
      user_id: userId,
      lesson_id: input.lessonId,
      last_position: input.lastPosition,
      seconds_listened: input.secondsListened,
      completed: input.completed,
    },
    { onConflict: "user_id,lesson_id" }
  );

  if (error) throw error;
}
