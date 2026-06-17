import { createClient } from "@/lib/supabase/server";
import { AdminContent } from "./admin-content";
import type { AdminData } from "./types";

export default async function AdminContentPage() {
  const supabase = await createClient();

  const [
    { data: courses },
    { data: lessons },
    { data: quizzes },
    { data: questions },
    { data: flashcards },
    { data: teachers },
  ] = await Promise.all([
    supabase.from("courses").select("*").order("display_order"),
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
  ]);

  const data: AdminData = {
    courses: courses ?? [],
    lessons: (lessons ?? []) as AdminData["lessons"],
    quizzes: (quizzes ?? []) as AdminData["quizzes"],
    questions: questions ?? [],
    flashcards: flashcards ?? [],
    teachers: teachers ?? [],
  };

  return <AdminContent data={data} />;
}
