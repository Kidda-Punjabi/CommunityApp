import "server-only";

import { isLearnEnglishModeEnabled } from "@/lib/learning/learn-english-mode";
import { fetchAccessiblePrivateCourses } from "@/lib/learning/private-courses";
import type { SupabaseClient } from "@supabase/supabase-js";

export type GamesContentScope =
  | { mode: "public" }
  | { mode: "english"; courseIds: string[] };

/**
 * Resolve which flashcard universe Games should use for this request.
 * English mode requires both the session cookie and a private course_access grant.
 */
export async function resolveGamesContentScope(
  supabase: SupabaseClient,
  userId: string
): Promise<GamesContentScope> {
  const englishModeOn = await isLearnEnglishModeEnabled();
  if (!englishModeOn) return { mode: "public" };

  const privateCourses = await fetchAccessiblePrivateCourses(supabase, userId);
  if (privateCourses.length === 0) return { mode: "public" };

  return {
    mode: "english",
    courseIds: privateCourses.map((course) => course.id),
  };
}

type LessonVisibility = {
  courseId: string;
  isPublic: boolean;
};

/**
 * Map lesson_id → course visibility for cards the caller can read via RLS.
 * Private lessons the user cannot read are simply absent — those cards must
 * be dropped in public mode (closes the open-flashcards RLS leak).
 */
async function loadLessonVisibilityMap(
  supabase: SupabaseClient,
  lessonIds: string[]
): Promise<Map<string, LessonVisibility>> {
  const unique = [...new Set(lessonIds.filter(Boolean))];
  const map = new Map<string, LessonVisibility>();
  if (unique.length === 0) return map;

  const { data } = await supabase
    .from("lessons")
    .select("id, course_id, courses(is_public)")
    .in("id", unique);

  for (const row of data ?? []) {
    const course = Array.isArray(row.courses) ? row.courses[0] : row.courses;
    map.set(row.id as string, {
      courseId: row.course_id as string,
      isPublic: course?.is_public !== false,
    });
  }

  return map;
}

/**
 * Filter flashcard rows for Games pools / pickers.
 * - public mode: only cards on public courses (or lesson_id null). Private-linked cards excluded even if readable.
 * - english mode: only cards on the user's accessible private course(s).
 */
export async function filterFlashcardsForGamesScope<
  T extends { lesson_id?: string | null },
>(
  supabase: SupabaseClient,
  cards: T[],
  scope: GamesContentScope
): Promise<T[]> {
  if (cards.length === 0) return cards;

  const lessonIds = cards
    .map((card) => card.lesson_id)
    .filter((id): id is string => Boolean(id));
  const visibility = await loadLessonVisibilityMap(supabase, lessonIds);

  if (scope.mode === "english") {
    const allowed = new Set(scope.courseIds);
    return cards.filter((card) => {
      if (!card.lesson_id) return false;
      const lesson = visibility.get(card.lesson_id);
      return Boolean(lesson && allowed.has(lesson.courseId));
    });
  }

  return cards.filter((card) => {
    if (!card.lesson_id) return true;
    const lesson = visibility.get(card.lesson_id);
    // Unreadable private lesson → exclude (leak close). Readable private → exclude in public mode.
    if (!lesson) return false;
    return lesson.isPublic;
  });
}

/** True when Games should present English-only flashcard content. */
export function isEnglishGamesScope(scope: GamesContentScope): boolean {
  return scope.mode === "english";
}
