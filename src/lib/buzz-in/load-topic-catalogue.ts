import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadScopedFlashcardPoolRows } from "@/lib/games/load-scoped-flashcards";
import {
  countDistinctQuestions,
  toBuzzInCard,
  type BuzzInCard,
  type BuzzInSourceCard,
} from "@/lib/buzz-in/question-quality";
import {
  BUZZ_IN_COURSES,
  BUZZ_IN_THEMES,
  cleanLessonTitle,
  courseAllTags,
  courseWeekNumbers,
  type BuzzInTopicCatalogue,
} from "@/lib/buzz-in/topic-catalogue";

/** Every card this user may see that Buzz-in can ask fairly. */
export async function loadBuzzInCards(
  supabase: SupabaseClient,
  userId: string
): Promise<BuzzInCard[]> {
  const { rows, error } = await loadScopedFlashcardPoolRows<
    BuzzInSourceCard & { lesson_id: string | null }
  >(supabase, userId, "id, front_text, back_text, romanised, topic_tags, lesson_id");
  if (error) throw new Error(error);
  return rows
    .map((row) => toBuzzInCard(row))
    .filter((card): card is BuzzInCard => card !== null);
}

export function cardsWithAnyTag(cards: BuzzInCard[], tags: string[]): BuzzInCard[] {
  if (tags.length === 0) return cards;
  const wanted = new Set(tags.map((tag) => tag.toLowerCase()));
  return cards.filter((card) => card.tags.some((tag) => wanted.has(tag)));
}

async function loadLessonTitles(
  supabase: SupabaseClient
): Promise<Map<string, Map<number, string>>> {
  const names = BUZZ_IN_COURSES.map((course) => course.dbName).filter(
    (name): name is string => Boolean(name)
  );
  const titles = new Map<string, Map<number, string>>();
  const { data, error } = await supabase
    .from("lessons")
    .select("lesson_number, title, courses!inner(name)")
    .in("courses.name", names);
  if (error || !data) return titles;
  for (const row of data as unknown as Array<{
    lesson_number: number | null;
    title: string | null;
    courses: { name: string } | { name: string }[] | null;
  }>) {
    const course = Array.isArray(row.courses) ? row.courses[0] : row.courses;
    if (!course?.name || row.lesson_number == null || !row.title) continue;
    const byNumber = titles.get(course.name) ?? new Map<number, string>();
    byNumber.set(row.lesson_number, cleanLessonTitle(row.title));
    titles.set(course.name, byNumber);
  }
  return titles;
}

export async function loadBuzzInTopicCatalogue(
  supabase: SupabaseClient
): Promise<BuzzInTopicCatalogue> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { courses: [], themes: [] };

  const [cards, titles] = await Promise.all([
    loadBuzzInCards(supabase, user.id),
    loadLessonTitles(supabase),
  ]);

  const courses = BUZZ_IN_COURSES.map((course) => {
    const dbTitles = course.dbName ? titles.get(course.dbName) : undefined;
    const weeks = course.available
      ? courseWeekNumbers(course).map((n) => {
          const tags = course.tagsForWeek(n);
          return {
            id: `${course.id}-${n}`,
            number: n,
            // The fallback titles are the course's teaching names; prefer them for Beginners.
            title: course.fallbackTitles?.[n] ?? dbTitles?.get(n) ?? `Week ${n}`,
            tags,
            count: countDistinctQuestions(cardsWithAnyTag(cards, tags)),
          };
        })
      : [];
    const allTags = course.available ? courseAllTags(course) : [];
    return {
      id: course.id,
      label: course.label,
      subtitle: course.available
        ? `${weeks.length} ${course.id === "community" ? "weekly sessions" : "weeks"}`
        : course.weekCount > 0
          ? `${course.weekCount} weeks`
          : "Not started yet",
      available: course.available,
      weeks,
      allTags,
      mixedCount: allTags.length
        ? countDistinctQuestions(cardsWithAnyTag(cards, allTags))
        : 0,
    };
  });

  const themes = BUZZ_IN_THEMES.map((theme) => ({
    ...theme,
    count: countDistinctQuestions(cardsWithAnyTag(cards, theme.tags)),
  }));

  return { courses, themes };
}
