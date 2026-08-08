import type { SupabaseClient } from "@supabase/supabase-js";
import { LEARN_ENGLISH_CONTENT_TRACK } from "@/lib/learning/private-courses";

export type LearningProduct = "punjabi" | "english";

/** Resolve product from a lesson's course content_track. */
export async function learningProductForLesson(
  supabase: SupabaseClient,
  lessonId: string
): Promise<LearningProduct> {
  const { data } = await supabase
    .from("lessons")
    .select("courses(content_track)")
    .eq("id", lessonId)
    .maybeSingle();

  const course = unwrapRelation(
    data?.courses as
      | { content_track: string | null }
      | { content_track: string | null }[]
      | null
      | undefined
  );

  return course?.content_track === LEARN_ENGLISH_CONTENT_TRACK
    ? "english"
    : "punjabi";
}

/** Resolve product from a quiz's course content_track. */
export async function learningProductForQuiz(
  supabase: SupabaseClient,
  quizId: string
): Promise<LearningProduct> {
  const { data } = await supabase
    .from("quizzes")
    .select("courses(content_track)")
    .eq("id", quizId)
    .maybeSingle();

  const course = unwrapRelation(
    data?.courses as
      | { content_track: string | null }
      | { content_track: string | null }[]
      | null
      | undefined
  );

  return course?.content_track === LEARN_ENGLISH_CONTENT_TRACK
    ? "english"
    : "punjabi";
}

/** Resolve product from a flashcard's lesson → course content_track. */
export async function learningProductForFlashcard(
  supabase: SupabaseClient,
  flashcardId: string
): Promise<LearningProduct> {
  const { data } = await supabase
    .from("flashcards")
    .select("lessons(courses(content_track))")
    .eq("id", flashcardId)
    .maybeSingle();

  const lesson = unwrapRelation(
    data?.lessons as
      | { courses: { content_track: string | null } | { content_track: string | null }[] | null }
      | {
          courses: { content_track: string | null } | { content_track: string | null }[] | null;
        }[]
      | null
      | undefined
  );
  const course = unwrapRelation(lesson?.courses ?? null);

  return course?.content_track === LEARN_ENGLISH_CONTENT_TRACK
    ? "english"
    : "punjabi";
}

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
