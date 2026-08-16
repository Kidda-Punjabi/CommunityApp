import type { SupabaseClient } from "@supabase/supabase-js";
import { tryAwardLessonCompletionPoints } from "@/lib/leaderboard/points";
import {
  actorFilter,
  lessonProgressWrite,
  resolveCourseActor,
} from "@/lib/kids/course-actor";

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
  const actor = await resolveCourseActor(supabase, userId);
  const filter = actorFilter(actor);
  const { data } = await supabase
    .from("lesson_progress")
    .select(
      "lesson_id, completed, seconds_listened, last_position, last_page_viewed, total_pages, pdf_completed"
    )
    .eq(filter.column, filter.value);

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
  const actor = await resolveCourseActor(supabase, userId);
  const { error } = await supabase.from("lesson_progress").upsert(
    lessonProgressWrite(actor, {
      lesson_id: input.lessonId,
      last_position: input.lastPosition,
      seconds_listened: input.secondsListened,
      completed: input.completed,
    }),
    {
      onConflict:
        actor.kind === "kid" ? "kid_profile_id,lesson_id" : "user_id,lesson_id",
    }
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
  const actor = await resolveCourseActor(supabase, userId);
  const { error } = await supabase.from("lesson_progress").upsert(
    lessonProgressWrite(actor, {
      lesson_id: input.lessonId,
      last_page_viewed: input.lastPageViewed,
      total_pages: input.totalPages,
      pdf_completed: input.pdfCompleted,
    }),
    {
      onConflict:
        actor.kind === "kid" ? "kid_profile_id,lesson_id" : "user_id,lesson_id",
    }
  );

  if (error) throw error;

  return tryAwardLessonCompletionPoints(supabase, input.lessonId);
}
