import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type EnglishChapterScore,
  type EnglishExamMaterial,
  type EnglishExamQuestion,
  type EnglishLessonSentence,
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

export async function loadLessonSentences(
  supabase: SupabaseClient,
  lessonId: string
): Promise<EnglishLessonSentence[]> {
  const { data, error } = await supabase
    .from("lesson_sentences")
    .select(
      "id, lesson_id, sort_order, punjabi_text, romanised_text, english_text, punjabi_audio_url, english_audio_url, punjabi_audio_status, english_audio_status"
    )
    .eq("lesson_id", lessonId)
    .order("sort_order", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    lessonId: row.lesson_id as string,
    sortOrder: row.sort_order as number,
    punjabiText: (row.punjabi_text as string) ?? "",
    romanisedText: (row.romanised_text as string | null) ?? null,
    englishText: (row.english_text as string) ?? "",
    punjabiAudioUrl: (row.punjabi_audio_url as string | null) ?? null,
    englishAudioUrl: (row.english_audio_url as string | null) ?? null,
    punjabiAudioStatus: (row.punjabi_audio_status as string) ?? "none",
    englishAudioStatus: (row.english_audio_status as string) ?? "none",
  }));
}

export async function loadEnglishExamQuestions(
  supabase: SupabaseClient,
  courseId: string
): Promise<EnglishExamQuestion[]> {
  const [{ data: quizzes, error: quizError }, { data: lessons }] = await Promise.all([
    supabase
      .from("quizzes")
      .select("id, title, lesson_id, level_number")
      .eq("course_id", courseId),
    supabase
      .from("lessons")
      .select("id, title, lesson_number")
      .eq("course_id", courseId)
      .order("lesson_number", { ascending: true }),
  ]);

  if (quizError || !quizzes?.length) return [];

  const lessonById = new Map(
    (lessons ?? []).map((lesson) => [lesson.id as string, lesson])
  );
  const lessonByNumber = new Map(
    (lessons ?? []).map((lesson) => [lesson.lesson_number as number, lesson])
  );

  const quizMeta = new Map(
    quizzes.map((quiz) => {
      const lessonId = (quiz.lesson_id as string | null) ?? null;
      const byId = lessonId ? lessonById.get(lessonId) : null;
      const byLevel =
        !byId && quiz.level_number != null
          ? lessonByNumber.get(quiz.level_number as number)
          : null;
      const lesson = byId ?? byLevel ?? null;

      return [
        quiz.id as string,
        {
          quizTitle: (quiz.title as string) ?? "Practice",
          lessonId: (lesson?.id as string | null) ?? lessonId,
          lessonNumber: (lesson?.lesson_number as number | null) ?? null,
          chapterTitle:
            (lesson?.title as string | null) ??
            ((quiz.title as string) || "Chapter"),
        },
      ] as const;
    })
  );

  const quizIds = quizzes.map((quiz) => quiz.id as string);
  const { data: rows, error } = await supabase
    .from("quiz_questions")
    .select(
      "id, quiz_id, question_text, question_text_pa, option_a, option_b, option_c, option_d, option_a_pa, option_b_pa, option_c_pa, option_d_pa, correct_answer, explanation, explanation_pa, question_order, question_audio_en_url, question_audio_pa_url"
    )
    .in("quiz_id", quizIds)
    .order("question_order", { ascending: true });

  if (error || !rows) return [];

  return rows.map((row) => {
    const meta = quizMeta.get(row.quiz_id as string);
    return {
      id: row.id as string,
      quizId: row.quiz_id as string,
      quizTitle: meta?.quizTitle ?? "Practice",
      lessonId: meta?.lessonId ?? null,
      lessonNumber: meta?.lessonNumber ?? null,
      chapterTitle: meta?.chapterTitle ?? "Chapter",
      questionText: row.question_text as string,
      questionTextPa: (row.question_text_pa as string | null) ?? null,
      optionA: row.option_a as string,
      optionB: row.option_b as string,
      optionC: row.option_c as string,
      optionD: row.option_d as string,
      optionAPa: (row.option_a_pa as string | null) ?? null,
      optionBPa: (row.option_b_pa as string | null) ?? null,
      optionCPa: (row.option_c_pa as string | null) ?? null,
      optionDPa: (row.option_d_pa as string | null) ?? null,
      correctAnswer: row.correct_answer as "a" | "b" | "c" | "d",
      explanation: (row.explanation as string | null) ?? null,
      explanationPa: (row.explanation_pa as string | null) ?? null,
      questionOrder: row.question_order as number,
      questionAudioEnUrl: (row.question_audio_en_url as string | null) ?? null,
      questionAudioPaUrl: (row.question_audio_pa_url as string | null) ?? null,
    };
  });
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

export function filterEnglishQuestionsByLesson(
  bank: EnglishExamQuestion[],
  lessonId: string
): EnglishExamQuestion[] {
  return bank.filter((question) => question.lessonId === lessonId);
}

export function scoreEnglishExamByChapter(
  questions: EnglishExamQuestion[],
  answers: Record<string, string>,
  courseId: string
): EnglishChapterScore[] {
  const buckets = new Map<
    string,
    {
      lessonId: string;
      chapterTitle: string;
      lessonNumber: number | null;
      correct: number;
      total: number;
    }
  >();

  for (const question of questions) {
    const key = question.lessonId ?? question.quizId;
    const existing = buckets.get(key) ?? {
      lessonId: question.lessonId ?? question.quizId,
      chapterTitle: question.chapterTitle,
      lessonNumber: question.lessonNumber,
      correct: 0,
      total: 0,
    };
    existing.total += 1;
    if (answers[question.id] === question.correctAnswer) {
      existing.correct += 1;
    }
    buckets.set(key, existing);
  }

  return [...buckets.values()]
    .map((bucket) => ({
      lessonId: bucket.lessonId,
      chapterTitle: bucket.chapterTitle,
      lessonNumber: bucket.lessonNumber,
      correct: bucket.correct,
      total: bucket.total,
      percent:
        bucket.total > 0 ? Math.round((bucket.correct / bucket.total) * 100) : 0,
      materialsHref: `/dashboard/english/learn/${courseId}/materials/${bucket.lessonId}`,
    }))
    .sort((a, b) => (a.lessonNumber ?? 99) - (b.lessonNumber ?? 99));
}
