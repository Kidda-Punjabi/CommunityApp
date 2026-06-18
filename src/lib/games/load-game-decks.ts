import type { SupabaseClient, User } from "@supabase/supabase-js";
import { canAccessLesson } from "@/lib/membership/access";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import {
  getLessonFlashcardSets,
  type FlashcardRow,
} from "@/lib/learning/match-lesson-content";

export type GameDeckSummary = {
  lessonId: string;
  deckId: string;
  setName: string;
  courseName: string;
  lessonTitle: string;
  cardCount: number;
};

export async function loadAccessibleGameDecks(
  supabase: SupabaseClient,
  user: User
): Promise<GameDeckSummary[]> {
  const [
    { data: lessons },
    { data: flashcards },
    { data: setCourseLinks },
    { data: flashcardSets },
  ] = await Promise.all([
    supabase
      .from("lessons")
      .select("id, course_id, lesson_number, title, is_free, courses(name)")
      .order("lesson_number"),
    supabase
      .from("flashcards")
      .select("id, lesson_id, deck_id, deck_name, front_text, back_text"),
    supabase.from("set_course_links").select("deck_id, lesson_id, course_id"),
    supabase.from("flashcard_sets").select("id, name"),
  ]);

  const access = await getCourseAccessContext(supabase, user);
  const flashcardRows = (flashcards ?? []) as FlashcardRow[];
  const setNames = new Map(
    (flashcardSets ?? []).map((set) => [set.id, set.name as string])
  );

  return (lessons ?? []).flatMap((lesson) => {
    if (!canAccessLesson(access.unlockedCourseIds, lesson)) return [];

    const course = Array.isArray(lesson.courses)
      ? lesson.courses[0]
      : lesson.courses;

    const sets = getLessonFlashcardSets(
      lesson.id,
      flashcardRows,
      setCourseLinks ?? [],
      setNames
    );

    return sets
      .filter((set) => set.cardCount > 0)
      .map((set) => ({
        lessonId: lesson.id,
        deckId: set.deckId,
        setName: set.name,
        courseName: course?.name ?? "Course",
        lessonTitle: lesson.title ?? "Lesson",
        cardCount: set.cardCount,
      }));
  });
}
