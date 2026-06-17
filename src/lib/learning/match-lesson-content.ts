export type LessonPracticeLinks = {
  quizId: string | null;
  quizTitle: string | null;
  flashcardCount: number;
};

export type QuizRow = {
  id: string;
  course_id: string;
  level_number: number;
  title: string;
};

export type FlashcardRow = {
  id: string;
  lesson_id: string | null;
  deck_name: string;
  front_text: string;
  back_text: string;
};

export function getLessonPracticeLinks(
  lesson: { id: string; course_id: string; lesson_number: number },
  quizzes: QuizRow[],
  flashcards: FlashcardRow[]
): LessonPracticeLinks {
  const quiz =
    quizzes.find(
      (item) =>
        item.course_id === lesson.course_id &&
        item.level_number === lesson.lesson_number
    ) ?? null;

  const lessonFlashcards = flashcards.filter(
    (card) => card.lesson_id === lesson.id
  );

  return {
    quizId: quiz?.id ?? null,
    quizTitle: quiz?.title ?? null,
    flashcardCount: lessonFlashcards.length,
  };
}
