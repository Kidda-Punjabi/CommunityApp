import {
  getLessonPracticeLinks,
  type FlashcardRow,
  type QuizRow,
} from "@/lib/learning/match-lesson-content";
import type { LessonWithCourse } from "@/app/dashboard/learn/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export { findCourseForTier } from "@/lib/membership/courses";

export async function fetchLearnContent(supabase: SupabaseClient) {
  const [
    { data: lessons },
    { data: quizzes },
    { data: flashcards },
    { data: setCourseLinks },
    { data: flashcardSets },
  ] = await Promise.all([
    supabase
      .from("lessons")
      .select(
        "id, course_id, lesson_number, title, audio_url, pdf_url, presentation_url, is_free, courses(name)"
      )
      .order("lesson_number"),
    supabase.from("quizzes").select("id, course_id, level_number, title"),
    supabase
      .from("flashcards")
      .select("id, lesson_id, deck_id, deck_name, front_text, back_text"),
    supabase.from("set_course_links").select("deck_id, lesson_id, course_id"),
    supabase.from("flashcard_sets").select("id, name"),
  ]);

  const quizRows = (quizzes ?? []) as QuizRow[];
  const flashcardRows = (flashcards ?? []) as FlashcardRow[];
  const linkRows = setCourseLinks ?? [];
  const setNames = new Map(
    (flashcardSets ?? []).map((set) => [set.id, set.name as string])
  );

  const normalizedLessons: LessonWithCourse[] = (lessons ?? []).map((lesson) => {
    const course = Array.isArray(lesson.courses)
      ? lesson.courses[0]
      : lesson.courses;

    const base = {
      id: lesson.id,
      course_id: lesson.course_id,
      lesson_number: lesson.lesson_number,
      title: lesson.title,
      audio_url: lesson.audio_url,
      pdf_url: lesson.pdf_url,
      presentation_url: lesson.presentation_url ?? null,
      is_free: lesson.is_free,
      courses: course ? { name: course.name } : null,
    };

    return {
      ...base,
      practice: getLessonPracticeLinks(base, quizRows, flashcardRows, linkRows, setNames),
    };
  });

  return normalizedLessons;
}

export function filterFreeLessons(lessons: LessonWithCourse[]) {
  return lessons.filter((lesson) => lesson.is_free);
}

export function filterLessonsForCourse(lessons: LessonWithCourse[], courseId: string) {
  return lessons.filter((lesson) => lesson.course_id === courseId);
}
