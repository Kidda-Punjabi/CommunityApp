import "server-only";

import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PublicQuizPayload = {
  quizId: string;
  quizTitle: string;
  courseName: string;
  lessonNumber: number | null;
  questions: Array<{
    id: string;
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_answer: string;
    question_order: number;
    question_audio_pa_url?: string | null;
  }>;
};

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export async function loadPublicQuizById(quizId: string): Promise<PublicQuizPayload | null> {
  if (!isUuid(quizId)) return null;

  const { client, error } = tryCreateServiceRoleClient();
  if (error || !client) return null;

  const { data: quiz, error: quizError } = await client
    .from("quizzes")
    .select("id, title, level_number, courses(name)")
    .eq("id", quizId)
    .maybeSingle();

  if (quizError || !quiz) return null;

  const { data: questions, error: questionsError } = await client
    .from("quiz_questions")
    .select(
      "id, question_text, option_a, option_b, option_c, option_d, correct_answer, question_order, question_audio_pa_url"
    )
    .eq("quiz_id", quizId)
    .order("question_order");

  if (questionsError || !questions?.length) return null;

  const course = Array.isArray(quiz.courses) ? quiz.courses[0] : quiz.courses;

  return {
    quizId: quiz.id,
    quizTitle: quiz.title,
    courseName: (course as { name?: string } | null)?.name ?? "Beginners Course",
    lessonNumber: quiz.level_number ?? null,
    questions,
  };
}

export async function loadBeginnersLessonId(
  lessonNumber: number
): Promise<string | null> {
  const { client, error } = tryCreateServiceRoleClient();
  if (error || !client) return null;

  const { data: course } = await client
    .from("courses")
    .select("id")
    .eq("name", "Beginners Course")
    .maybeSingle();

  if (!course?.id) return null;

  const { data: lesson } = await client
    .from("lessons")
    .select("id")
    .eq("course_id", course.id)
    .eq("lesson_number", lessonNumber)
    .maybeSingle();

  return lesson?.id ?? null;
}
