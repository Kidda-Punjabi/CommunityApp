import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { HomeworkSubmissionType } from "@/lib/tutoring/homework-submissions";

export type HomeworkQuestion = {
  id: string;
  questionNumber: number;
  promptEnglish: string;
};

export type HomeworkSegment = {
  id: string;
  title: string | null;
  activityInstructions: string | null;
  submissionType: HomeworkSubmissionType;
};

function isMissingTable(message: string, table: string): boolean {
  return message.toLowerCase().includes(table);
}

export async function loadHomeworkSegmentForLesson(
  supabase: SupabaseClient,
  lessonId: string
): Promise<HomeworkSegment | null> {
  const { data, error } = await supabase
    .from("lesson_segments")
    .select("id, title, activity_instructions, homework_submission_type")
    .eq("lesson_id", lessonId)
    .eq("activity_type", "homework")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error.message, "lesson_segments")) return null;
    throw error;
  }

  if (!data) return null;

  return {
    id: data.id as string,
    title: (data.title as string | null) ?? null,
    activityInstructions: (data.activity_instructions as string | null) ?? null,
    submissionType: data.homework_submission_type === "text" ? "text" : "voice",
  };
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
    .select("id, question_number, prompt_english")
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
  }));
}
