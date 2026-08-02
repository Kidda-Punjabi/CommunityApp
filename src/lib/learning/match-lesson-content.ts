export type FlashcardSetInfo = {
  deckId: string;
  name: string;
  cardCount: number;
  cardIds: string[];
};

export type LessonPracticeLinks = {
  quizId: string | null;
  quizTitle: string | null;
  flashcardCount: number;
  flashcardSets: FlashcardSetInfo[];
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
  deck_id: string | null;
  deck_name: string;
  front_text: string;
  back_text: string;
};

export type SetCourseLinkRow = {
  deck_id: string;
  lesson_id: string | null;
  course_id: string | null;
};

/** Synthetic deck id for flashcards linked only via lesson_id (deck_id null). */
export const LESSON_SCOPED_DECK_ID = "lesson";

export function getLessonFlashcardSets(
  lessonId: string,
  flashcards: FlashcardRow[],
  setCourseLinks: SetCourseLinkRow[],
  setNames: Map<string, string> = new Map()
): FlashcardSetInfo[] {
  const linkedDeckIds = [
    ...new Set(
      setCourseLinks
        .filter((link) => link.lesson_id === lessonId)
        .map((link) => link.deck_id)
    ),
  ];

  const deckIds = new Set(linkedDeckIds);

  for (const card of flashcards) {
    if (card.lesson_id === lessonId && card.deck_id) {
      deckIds.add(card.deck_id);
    }
  }

  const sets: FlashcardSetInfo[] = [];

  for (const deckId of deckIds) {
    const deckLinked = linkedDeckIds.includes(deckId);
    const cardIds = flashcards
      .filter((card) => {
        if (card.deck_id !== deckId) return false;
        if (deckLinked) return true;
        return card.lesson_id === lessonId;
      })
      .map((card) => card.id);

    if (cardIds.length === 0) continue;

    const sample = flashcards.find((card) => card.deck_id === deckId);
    const name =
      setNames.get(deckId)?.trim() ||
      sample?.deck_name?.trim() ||
      "Flashcards";

    sets.push({
      deckId,
      name,
      cardCount: cardIds.length,
      cardIds,
    });
  }

  // Lesson-scoped cards with no deck_id (e.g. private English Foundations).
  const lessonOnlyCards = flashcards.filter(
    (card) => card.lesson_id === lessonId && !card.deck_id
  );
  if (lessonOnlyCards.length > 0) {
    sets.push({
      deckId: LESSON_SCOPED_DECK_ID,
      name: lessonOnlyCards[0]?.deck_name?.trim() || "Flashcards",
      cardCount: lessonOnlyCards.length,
      cardIds: lessonOnlyCards.map((card) => card.id),
    });
  }

  return sets.sort((a, b) => a.name.localeCompare(b.name));
}

export function getLessonPracticeLinks(
  lesson: { id: string; course_id: string; lesson_number: number },
  quizzes: QuizRow[],
  flashcards: FlashcardRow[],
  setCourseLinks: SetCourseLinkRow[] = [],
  setNames: Map<string, string> = new Map()
): LessonPracticeLinks {
  const quiz =
    quizzes.find(
      (item) =>
        item.course_id === lesson.course_id &&
        item.level_number === lesson.lesson_number
    ) ?? null;

  const flashcardSets = getLessonFlashcardSets(
    lesson.id,
    flashcards,
    setCourseLinks,
    setNames
  );

  return {
    quizId: quiz?.id ?? null,
    quizTitle: quiz?.title ?? null,
    flashcardCount: flashcardSets.reduce((sum, set) => sum + set.cardCount, 0),
    flashcardSets,
  };
}
