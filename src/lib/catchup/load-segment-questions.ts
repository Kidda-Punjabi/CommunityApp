import type { SupabaseClient } from "@supabase/supabase-js";

export type FillBlankQuestion = {
  id: string;
  questionNumber: number;
  promptGurmukhi: string;
  promptRomanised: string | null;
  promptEnglish: string | null;
  blankAnswerRomanised: string;
  blankAnswerGurmukhi: string | null;
};

export type TranslateQuestion = {
  id: string;
  questionNumber: number;
  promptEnglish: string;
  answerRomanised: string;
  answerGurmukhi: string | null;
};

export type HomeworkTextQuestion = {
  id: string;
  questionNumber: number;
  promptEnglish: string;
};

export type HomeworkTextQuestionWithKey = HomeworkTextQuestion & {
  answerRomanised: string;
  answerGurmukhi: string | null;
};

export type TextHomeworkAnswer = {
  question_number: number;
  answer_text: string;
};

function isMissingTable(message: string, table: string): boolean {
  return message.toLowerCase().includes(table);
}

export async function loadFillBlankQuestions(
  supabase: SupabaseClient,
  segmentId: string
): Promise<FillBlankQuestion[]> {
  const { data, error } = await supabase
    .from("fill_blank_questions")
    .select(
      "id, question_number, prompt_gurmukhi, prompt_romanised, prompt_english, blank_answer_romanised, blank_answer_gurmukhi"
    )
    .eq("segment_id", segmentId)
    .order("question_number", { ascending: true });

  if (error) {
    if (isMissingTable(error.message, "fill_blank_questions")) return [];
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    questionNumber: row.question_number as number,
    promptGurmukhi: row.prompt_gurmukhi as string,
    promptRomanised: (row.prompt_romanised as string | null) ?? null,
    promptEnglish: (row.prompt_english as string | null) ?? null,
    blankAnswerRomanised: row.blank_answer_romanised as string,
    blankAnswerGurmukhi: (row.blank_answer_gurmukhi as string | null) ?? null,
  }));
}

export async function loadTranslateQuestions(
  supabase: SupabaseClient,
  segmentId: string
): Promise<TranslateQuestion[]> {
  const { data, error } = await supabase
    .from("translate_questions")
    .select("id, question_number, prompt_english, answer_romanised, answer_gurmukhi")
    .eq("segment_id", segmentId)
    .order("question_number", { ascending: true });

  if (error) {
    if (isMissingTable(error.message, "translate_questions")) return [];
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    questionNumber: row.question_number as number,
    promptEnglish: row.prompt_english as string,
    answerRomanised: row.answer_romanised as string,
    answerGurmukhi: (row.answer_gurmukhi as string | null) ?? null,
  }));
}

export async function loadHomeworkTextQuestions(
  supabase: SupabaseClient,
  segmentId: string
): Promise<HomeworkTextQuestion[]> {
  const { data, error } = await supabase
    .from("homework_text_questions")
    .select("id, question_number, prompt_english")
    .eq("segment_id", segmentId)
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

export async function loadHomeworkTextQuestionsWithKeys(
  supabase: SupabaseClient,
  segmentId: string
): Promise<HomeworkTextQuestionWithKey[]> {
  const { data, error } = await supabase
    .from("homework_text_questions")
    .select("id, question_number, prompt_english, answer_romanised, answer_gurmukhi")
    .eq("segment_id", segmentId)
    .order("question_number", { ascending: true });

  if (error) {
    if (isMissingTable(error.message, "homework_text_questions")) return [];
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    questionNumber: row.question_number as number,
    promptEnglish: row.prompt_english as string,
    answerRomanised: row.answer_romanised as string,
    answerGurmukhi: (row.answer_gurmukhi as string | null) ?? null,
  }));
}

export async function loadHomeworkTextQuestionsForLesson(
  supabase: SupabaseClient,
  lessonId: string
): Promise<HomeworkTextQuestionWithKey[]> {
  const { data: segments, error: segmentError } = await supabase
    .from("lesson_segments")
    .select("id")
    .eq("lesson_id", lessonId)
    .eq("activity_type", "homework")
    .eq("homework_submission_type", "text")
    .order("sort_order", { ascending: false })
    .limit(1);

  if (segmentError) {
    if (isMissingTable(segmentError.message, "homework_submission_type")) return [];
    throw segmentError;
  }

  const segmentId = segments?.[0]?.id as string | undefined;
  if (!segmentId) return [];

  return loadHomeworkTextQuestionsWithKeys(supabase, segmentId);
}
