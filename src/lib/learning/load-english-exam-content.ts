import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type EnglishExamMaterial,
  type EnglishExamQuestion,
} from "@/lib/learning/english-exam-courses";

export async function loadEnglishExamMaterials(
  supabase: SupabaseClient,
  courseId: string
): Promise<EnglishExamMaterial[]> {
  const { data, error } = await supabase
    .from("lessons")
    .select("id, title, lesson_number, audio_script")
    .eq("course_id", courseId)
    .order("lesson_number", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    title: row.title as string,
    lessonNumber: row.lesson_number as number,
    audioScript: ((row.audio_script as string | null) ?? "").trim(),
  }));
}

export async function loadEnglishExamQuestions(
  supabase: SupabaseClient,
  courseId: string
): Promise<EnglishExamQuestion[]> {
  const { data: quizzes, error: quizError } = await supabase
    .from("quizzes")
    .select("id")
    .eq("course_id", courseId);

  if (quizError || !quizzes?.length) return [];

  const quizIds = quizzes.map((quiz) => quiz.id as string);
  const { data: rows, error } = await supabase
    .from("quiz_questions")
    .select(
      "id, quiz_id, question_text, question_text_pa, option_a, option_b, option_c, option_d, correct_answer, explanation, explanation_pa, question_order"
    )
    .in("quiz_id", quizIds)
    .order("question_order", { ascending: true });

  if (error || !rows) return [];

  return rows.map((row) => ({
    id: row.id as string,
    quizId: row.quiz_id as string,
    questionText: row.question_text as string,
    questionTextPa: (row.question_text_pa as string | null) ?? null,
    optionA: row.option_a as string,
    optionB: row.option_b as string,
    optionC: row.option_c as string,
    optionD: row.option_d as string,
    correctAnswer: row.correct_answer as "a" | "b" | "c" | "d",
    explanation: (row.explanation as string | null) ?? null,
    explanationPa: (row.explanation_pa as string | null) ?? null,
    questionOrder: row.question_order as number,
  }));
}

/** Fisher–Yates shuffle (copy). */
export function shuffleEnglishExamQuestions(
  questions: EnglishExamQuestion[]
): EnglishExamQuestion[] {
  const copy = [...questions];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export function drawEnglishMockQuestions(
  bank: EnglishExamQuestion[],
  count: number
): EnglishExamQuestion[] {
  if (bank.length === 0) return [];
  const shuffled = shuffleEnglishExamQuestions(bank);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
