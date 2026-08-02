import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { PaidCourseTier } from "@/lib/membership/access";
import { canAccessLesson } from "@/lib/membership/access";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import {
  getLessonFlashcardSets,
  type FlashcardRow,
} from "@/lib/learning/match-lesson-content";
import {
  resolveGamesContentScope,
} from "@/lib/games/content-scope";
import { isPublicLearnCourse } from "@/lib/membership/courses";

export type GameDeckSummary = {
  lessonId: string;
  deckId: string;
  setName: string;
  courseName: string;
  courseTier: PaidCourseTier | null;
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
    access,
    scope,
  ] = await Promise.all([
    supabase
      .from("lessons")
      .select("id, course_id, lesson_number, title, is_free, courses(name, required_tier, is_public)")
      .order("lesson_number"),
    supabase
      .from("flashcards")
      .select("id, lesson_id, deck_id, deck_name, front_text, back_text"),
    supabase.from("set_course_links").select("deck_id, lesson_id, course_id"),
    supabase.from("flashcard_sets").select("id, name"),
    getCourseAccessContext(supabase, user),
    resolveGamesContentScope(supabase, user.id),
  ]);

  const flashcardRows = (flashcards ?? []) as FlashcardRow[];
  const setNames = new Map(
    (flashcardSets ?? []).map((set) => [set.id, set.name as string])
  );

  const englishCourseIds =
    scope.mode === "english" ? new Set(scope.courseIds) : null;

  return (lessons ?? []).flatMap((lesson) => {
    if (!canAccessLesson(access.unlockedCourseIds, lesson)) return [];

    const course = Array.isArray(lesson.courses)
      ? lesson.courses[0]
      : lesson.courses;
    const courseRecord = course
      ? {
          id: lesson.course_id as string,
          name: (course.name as string) ?? "Course",
          required_tier: (course.required_tier as string | null) ?? null,
          is_public: (course.is_public as boolean | null) ?? null,
        }
      : null;

    if (englishCourseIds) {
      if (!englishCourseIds.has(lesson.course_id as string)) return [];
    } else if (courseRecord && !isPublicLearnCourse(courseRecord)) {
      return [];
    }

    const courseTier = (course?.required_tier as PaidCourseTier | null) ?? null;

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
        courseTier,
        lessonTitle: lesson.title ?? "Lesson",
        cardCount: set.cardCount,
      }));
  });
}
