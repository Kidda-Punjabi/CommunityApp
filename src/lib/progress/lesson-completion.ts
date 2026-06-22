import type { SupabaseClient } from "@supabase/supabase-js";
import { isQuizPassing } from "@/lib/progress/quiz-progress";

export type LessonCompletionStatus = {
  fullyComplete: boolean;
  audioComplete: boolean;
  audioRequired: boolean;
  pdfComplete: boolean;
  pdfRequired: boolean;
  flashcardsComplete: boolean;
  flashcardsRequired: boolean;
  quizComplete: boolean;
  quizRequired: boolean;
  partsTotal: number;
  partsDone: number;
};

export type CourseProgressSummary = {
  totalLessons: number;
  completedLessons: number;
  percentage: number;
};

type LessonRef = {
  id: string;
  course_id: string;
  lesson_number: number;
  pdf_url?: string | null;
  audio_url?: string | null;
};

type LessonProgressFlags = {
  audioComplete: boolean;
  pdfComplete: boolean;
};

type SetCourseLinkRow = {
  lesson_id: string | null;
  deck_id: string;
};

type FlashcardRow = {
  id: string;
  deck_id: string | null;
};

type QuizRow = {
  id: string;
  course_id: string;
  level_number: number;
  lesson_id: string | null;
};

export function computeLessonCompletionStatus(
  lesson: LessonRef,
  progress: LessonProgressFlags,
  linkedDeckIds: string[],
  flashcardsByDeck: Map<string, string[]>,
  confidentCardIds: Set<string>,
  lessonQuizIds: string[],
  quizProgressByQuizId: Map<string, { completed: boolean; score: number | null }>,
  questionCountByQuizId: Map<string, number>
): LessonCompletionStatus {
  const pdfRequired = false;
  const audioRequired = false;
  const pdfComplete = !Boolean(lesson.pdf_url) || progress.pdfComplete;
  const audioComplete = !Boolean(lesson.audio_url) || progress.audioComplete;

  const flashcardsRequired = linkedDeckIds.length > 0;

  let flashcardsComplete = true;
  if (flashcardsRequired) {
    const cardIds = linkedDeckIds.flatMap((deckId) => flashcardsByDeck.get(deckId) ?? []);
    flashcardsComplete =
      cardIds.length === 0 ||
      cardIds.every((cardId) => confidentCardIds.has(cardId));
  }

  const quizRequired = lessonQuizIds.length > 0;
  let quizComplete = true;
  if (quizRequired) {
    quizComplete = lessonQuizIds.every((quizId) =>
      isQuizPassing(quizProgressByQuizId.get(quizId), questionCountByQuizId.get(quizId) ?? 0)
    );
  }

  const partsTotal =
    (flashcardsRequired ? 1 : 0) +
    (quizRequired ? 1 : 0);

  const partsDone =
    (flashcardsRequired && flashcardsComplete ? 1 : 0) +
    (quizRequired && quizComplete ? 1 : 0);

  return {
    fullyComplete: partsTotal > 0 && partsDone === partsTotal,
    audioComplete,
    audioRequired,
    pdfComplete,
    pdfRequired,
    flashcardsComplete,
    flashcardsRequired,
    quizComplete,
    quizRequired,
    partsTotal,
    partsDone,
  };
}

function quizzesForLesson(lesson: LessonRef, quizzes: QuizRow[]): string[] {
  return quizzes
    .filter(
      (quiz) =>
        quiz.lesson_id === lesson.id ||
        (quiz.lesson_id === null &&
          quiz.course_id === lesson.course_id &&
          quiz.level_number === lesson.lesson_number)
    )
    .map((quiz) => quiz.id);
}

export async function fetchLessonCompletionMap(
  supabase: SupabaseClient,
  userId: string,
  lessons: LessonRef[]
): Promise<Map<string, LessonCompletionStatus>> {
  const result = new Map<string, LessonCompletionStatus>();
  if (lessons.length === 0) return result;

  const lessonIds = lessons.map((lesson) => lesson.id);
  const courseIds = [...new Set(lessons.map((lesson) => lesson.course_id))];

  const [
    { data: lessonProgress },
    { data: setLinks },
    { data: quizzes },
    { data: quizProgress },
  ] = await Promise.all([
    supabase
      .from("lesson_progress")
      .select("lesson_id, completed, pdf_completed")
      .eq("user_id", userId)
      .in("lesson_id", lessonIds),
    supabase
      .from("set_course_links")
      .select("lesson_id, deck_id")
      .in("lesson_id", lessonIds),
    supabase
      .from("quizzes")
      .select("id, course_id, level_number, lesson_id")
      .in("course_id", courseIds),
    supabase
      .from("quiz_progress")
      .select("quiz_id, completed, score")
      .eq("user_id", userId),
  ]);

  const deckIds = [
    ...new Set((setLinks ?? []).map((link) => link.deck_id as string)),
  ];

  let flashcards: FlashcardRow[] = [];
  if (deckIds.length > 0) {
    const { data } = await supabase
      .from("flashcards")
      .select("id, deck_id")
      .in("deck_id", deckIds);
    flashcards = data ?? [];
  }

  const cardIds = flashcards.map((card) => card.id);
  let flashcardProgress: { flashcard_id: string; confidence: string }[] = [];
  if (cardIds.length > 0) {
    const { data } = await supabase
      .from("flashcard_progress")
      .select("flashcard_id, confidence")
      .eq("user_id", userId)
      .in("flashcard_id", cardIds);
    flashcardProgress = data ?? [];
  }

  const lessonProgressMap = new Map(
    (lessonProgress ?? []).map((row) => [
      row.lesson_id,
      {
        audioComplete: row.completed ?? false,
        pdfComplete: row.pdf_completed ?? false,
      },
    ])
  );

  const decksByLesson = new Map<string, string[]>();
  for (const link of (setLinks ?? []) as SetCourseLinkRow[]) {
    if (!link.lesson_id) continue;
    const list = decksByLesson.get(link.lesson_id) ?? [];
    list.push(link.deck_id);
    decksByLesson.set(link.lesson_id, list);
  }

  const flashcardsByDeck = new Map<string, string[]>();
  for (const card of flashcards) {
    if (!card.deck_id) continue;
    const list = flashcardsByDeck.get(card.deck_id) ?? [];
    list.push(card.id);
    flashcardsByDeck.set(card.deck_id, list);
  }

  const confidentCardIds = new Set(
    flashcardProgress
      .filter((row) => row.confidence === "confident")
      .map((row) => row.flashcard_id)
  );

  const quizProgressByQuizId = new Map(
    (quizProgress ?? []).map((row) => [
      row.quiz_id,
      { completed: row.completed, score: row.score },
    ])
  );

  const quizRows = (quizzes ?? []) as QuizRow[];
  const quizIds = [...new Set(quizRows.map((quiz) => quiz.id))];

  const questionCountByQuizId = new Map<string, number>();
  if (quizIds.length > 0) {
    const { data: quizQuestions } = await supabase
      .from("quiz_questions")
      .select("quiz_id")
      .in("quiz_id", quizIds);

    for (const row of quizQuestions ?? []) {
      questionCountByQuizId.set(
        row.quiz_id,
        (questionCountByQuizId.get(row.quiz_id) ?? 0) + 1
      );
    }
  }

  for (const lesson of lessons) {
    const progress = lessonProgressMap.get(lesson.id) ?? {
      audioComplete: false,
      pdfComplete: false,
    };

    result.set(
      lesson.id,
      computeLessonCompletionStatus(
        lesson,
        progress,
        decksByLesson.get(lesson.id) ?? [],
        flashcardsByDeck,
        confidentCardIds,
        quizzesForLesson(lesson, quizRows),
        quizProgressByQuizId,
        questionCountByQuizId
      )
    );
  }

  return result;
}

export function summarizeCourseProgress(
  lessons: LessonRef[],
  completionMap: Map<string, LessonCompletionStatus>
): CourseProgressSummary {
  const totalLessons = lessons.length;
  const completedLessons = lessons.filter(
    (lesson) => completionMap.get(lesson.id)?.fullyComplete
  ).length;

  return {
    totalLessons,
    completedLessons,
    percentage:
      totalLessons === 0
        ? 0
        : Math.round((completedLessons / totalLessons) * 100),
  };
}

export async function fetchLessonCompletionStatus(
  supabase: SupabaseClient,
  userId: string,
  lessonId: string
): Promise<LessonCompletionStatus | null> {
  const { data, error } = await supabase.rpc("get_lesson_completion_status", {
    p_user_id: userId,
    p_lesson_id: lessonId,
  });

  if (error || !data?.[0]) return null;

  const row = data[0];
  return {
    fullyComplete: row.fully_complete,
    audioComplete: row.audio_complete,
    audioRequired: row.audio_required,
    pdfComplete: row.pdf_complete,
    pdfRequired: row.pdf_required,
    flashcardsComplete: row.flashcards_complete,
    flashcardsRequired: row.flashcards_required,
    quizComplete: row.quiz_complete,
    quizRequired: row.quiz_required,
    partsTotal: row.parts_total,
    partsDone: row.parts_done,
  };
}

export async function fetchCourseProgress(
  supabase: SupabaseClient,
  userId: string,
  courseId: string
): Promise<CourseProgressSummary> {
  const { data, error } = await supabase.rpc("get_course_progress", {
    p_user_id: userId,
    p_course_id: courseId,
  });

  if (error || !data?.[0]) {
    return { totalLessons: 0, completedLessons: 0, percentage: 0 };
  }

  return {
    totalLessons: data[0].total_lessons,
    completedLessons: data[0].completed_lessons,
    percentage: data[0].percentage,
  };
}
