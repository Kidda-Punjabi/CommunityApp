import {
  getLessonPracticeLinks,
  type FlashcardRow,
  type QuizRow,
} from "@/lib/learning/match-lesson-content";
import type { LessonWithCourse } from "@/app/dashboard/learn/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export { findCourseForTier } from "@/lib/membership/courses";

export async function fetchLearnContent(supabase: SupabaseClient) {
  const [{ data: lessons }, { data: quizzes }, { data: flashcards }] = await Promise.all([
    supabase
      .from("lessons")
      .select("id, course_id, lesson_number, title, audio_url, is_free, courses(name)")
      .order("lesson_number"),
    supabase.from("quizzes").select("id, course_id, level_number, title"),
    supabase
      .from("flashcards")
      .select("id, lesson_id, deck_name, front_text, back_text"),
  ]);

  const quizRows = (quizzes ?? []) as QuizRow[];
  const flashcardRows = (flashcards ?? []) as FlashcardRow[];

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
      is_free: lesson.is_free,
      courses: course ? { name: course.name } : null,
    };

    return {
      ...base,
      practice: getLessonPracticeLinks(base, quizRows, flashcardRows),
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
