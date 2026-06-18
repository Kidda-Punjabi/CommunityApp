import { canUserAccessLesson } from "@/lib/membership/lesson-access";
import { fetchFlashcardProgressMap } from "@/lib/progress/flashcard-progress";
import { fetchMatchScore } from "@/lib/progress/match-scores";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FlashcardDeckContext } from "./types";
import { getDeckName } from "./utils";

export async function loadFlashcardDeck(
  supabase: SupabaseClient,
  userId: string,
  lessonId: string
) {
  const access = await canUserAccessLesson(supabase, userId, lessonId);

  if (!access.lesson) {
    return { kind: "not_found" as const };
  }

  if (!access.allowed) {
    return {
      kind: "forbidden" as const,
      requiredCourseLabel: access.requiredCourseLabel,
    };
  }

  const lesson = access.lesson;
  const { data: cards } = await supabase
    .from("flashcards")
    .select("id, front_text, back_text, deck_name")
    .eq("lesson_id", lessonId)
    .order("created_at");

  if (!cards?.length) {
    return { kind: "empty" as const, lesson };
  }

  const course = Array.isArray(lesson.courses) ? lesson.courses[0] : lesson.courses;
  const deckName = getDeckName(cards);

  const [progressMap, matchScore] = await Promise.all([
    fetchFlashcardProgressMap(
      supabase,
      userId,
      cards.map((card) => card.id)
    ),
    fetchMatchScore(supabase, userId, deckName),
  ]);

  const deck: FlashcardDeckContext = {
    lessonId,
    lessonTitle: lesson.title ?? "Lesson",
    courseName: course?.name ?? "Course",
    lessonNumber: lesson.lesson_number ?? 0,
    deckName,
    cards,
  };

  return {
    kind: "ok" as const,
    deck,
    progress: [...progressMap.values()],
    matchScore,
  };
}
