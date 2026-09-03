import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { HomeworkQuestion } from "@/lib/tutoring/homework-question-display";

export type { HomeworkQuestion } from "@/lib/tutoring/homework-question-display";

function isMissingTable(message: string, table: string): boolean {
  return message.toLowerCase().includes(table);
}

export async function loadHomeworkQuestionsForLesson(
  supabase: SupabaseClient,
  lessonId: string
): Promise<HomeworkQuestion[]> {
  const { data: segments, error: segmentError } = await supabase
    .from("lesson_segments")
    .select("id")
    .eq("lesson_id", lessonId);

  if (segmentError) {
    if (isMissingTable(segmentError.message, "lesson_segments")) return [];
    throw segmentError;
  }

  const segmentIds = (segments ?? []).map((row) => row.id as string);
  if (segmentIds.length === 0) return [];

  const { data, error } = await supabase
    .from("homework_text_questions")
    .select("id, question_number, prompt_english, answer_gurmukhi, answer_romanised")
    .in("segment_id", segmentIds)
    .order("question_number", { ascending: true });

  if (error) {
    if (isMissingTable(error.message, "homework_text_questions")) return [];
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    questionNumber: row.question_number as number,
    promptEnglish: row.prompt_english as string,
    answerGurmukhi: (row.answer_gurmukhi as string | null) ?? null,
    answerRomanised: (row.answer_romanised as string | null) ?? null,
  }));
}
