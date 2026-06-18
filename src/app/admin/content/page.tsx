import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { ensureDefaultCourses } from "@/lib/courses/ensure-default-courses";
import { AdminContent } from "./admin-content";
import type { AdminData } from "./types";

export default async function AdminContentPage() {
  const supabase = createServiceRoleClient();

  await ensureDefaultCourses(supabase);

  const [
    { data: courses, error: coursesError },
    { data: lessons, error: lessonsError },
    { data: quizzes, error: quizzesError },
    { data: questions, error: questionsError },
    { data: flashcards, error: flashcardsError },
    { data: teachers, error: teachersError },
    { data: events, error: eventsError },
  ] = await Promise.all([
    supabase.from("courses").select("id, name, description, display_order").order("display_order"),
    supabase
      .from("lessons")
      .select("*, courses(name)")
      .order("course_id")
      .order("lesson_number"),
    supabase
      .from("quizzes")
      .select("*, courses(name)")
      .order("course_id")
      .order("level_number"),
    supabase
      .from("quiz_questions")
      .select("*")
      .order("quiz_id")
      .order("question_order"),
    supabase.from("flashcards").select("*").order("deck_name").order("created_at"),
    supabase.from("teachers").select("*").order("display_order"),
    supabase.from("events").select("*").order("starts_at", { ascending: false }),
  ]);

  const data: AdminData = {
    courses: courses ?? [],
    lessons: (lessons ?? []) as AdminData["lessons"],
    quizzes: (quizzes ?? []) as AdminData["quizzes"],
    questions: questions ?? [],
    flashcards: flashcards ?? [],
    teachers: teachers ?? [],
    events: events ?? [],
    errors: {
      courses: coursesError?.message,
      lessons: lessonsError?.message,
      quizzes: quizzesError?.message,
      questions: questionsError?.message,
      flashcards: flashcardsError?.message,
      teachers: teachersError?.message,
      events: eventsError?.message,
    },
  };

  return <AdminContent data={data} />;
}
