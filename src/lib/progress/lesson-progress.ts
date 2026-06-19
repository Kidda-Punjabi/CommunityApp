import type { SupabaseClient } from "@supabase/supabase-js";
import { tryAwardLessonCompletionPoints } from "@/lib/leaderboard/points";

export type LessonProgressRow = {
  lesson_id: string;
  completed: boolean;
  seconds_listened: number;
  last_position: number;
  last_page_viewed: number;
  total_pages: number;
  pdf_completed: boolean;
};

export async function fetchLessonProgressMap(
  supabase: SupabaseClient,
  userId: string
): Promise<Map<string, LessonProgressRow>> {
  const { data } = await supabase
    .from("lesson_progress")
    .select(
      "lesson_id, completed, seconds_listened, last_position, last_page_viewed, total_pages, pdf_completed"
    )
    .eq("user_id", userId);

  return new Map(
    (data ?? []).map((row) => [
      row.lesson_id,
      {
        lesson_id: row.lesson_id,
        completed: row.completed ?? false,
        seconds_listened: row.seconds_listened ?? 0,
        last_position: row.last_position ?? 0,
        last_page_viewed: row.last_page_viewed ?? 0,
        total_pages: row.total_pages ?? 0,
        pdf_completed: row.pdf_completed ?? false,
      },
    ])
  );
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
): Promise<number> {
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

  return tryAwardLessonCompletionPoints(supabase, input.lessonId);
}

export type SaveLessonPdfProgressInput = {
  lessonId: string;
  lastPageViewed: number;
  totalPages: number;
  pdfCompleted: boolean;
};

export async function saveLessonPdfProgress(
  supabase: SupabaseClient,
  userId: string,
  input: SaveLessonPdfProgressInput
): Promise<number> {
  const { error } = await supabase.from("lesson_progress").upsert(
    {
      user_id: userId,
      lesson_id: input.lessonId,
      last_page_viewed: input.lastPageViewed,
      total_pages: input.totalPages,
      pdf_completed: input.pdfCompleted,
    },
    { onConflict: "user_id,lesson_id" }
  );

  if (error) throw error;

  return tryAwardLessonCompletionPoints(supabase, input.lessonId);
}
