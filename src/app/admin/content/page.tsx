import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { ensureDefaultCourses } from "@/lib/courses/ensure-default-courses";
import { ensureStorageBuckets } from "@/lib/supabase/ensure-storage-buckets";
import { AdminContent } from "./admin-content";
import type { AdminData } from "./types";

export default async function AdminContentPage() {
  const supabase = createServiceRoleClient();

  await ensureDefaultCourses(supabase);
  await ensureStorageBuckets(supabase);

  const [
    { data: courses, error: coursesError },
    { data: lessons, error: lessonsError },
    { data: quizzes, error: quizzesError },
    { data: questions, error: questionsError },
    { data: flashcardSets, error: flashcardSetsError },
    { data: setCourseLinks, error: setCourseLinksError },
    { data: flashcards, error: flashcardsError },
    { data: teachers, error: teachersError },
    { data: events, error: eventsError },
    { data: grammarSentences, error: grammarSentencesError },
    { data: verbConjugations, error: verbConjugationsError },
    { data: genderedNouns, error: genderedNounsError },
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
    supabase.from("flashcard_sets").select("*").order("name"),
    supabase.from("set_course_links").select("*"),
    supabase.from("flashcards").select("*").order("deck_id").order("created_at"),
    supabase.from("teachers").select("*").order("display_order"),
    supabase.from("events").select("*").order("starts_at", { ascending: false }),
    supabase.from("grammar_sentences").select("*").order("created_at", { ascending: false }),
    supabase.from("verb_conjugations").select("*").order("verb_root"),
    supabase.from("gendered_nouns").select("*").order("punjabi_word"),
  ]);

  const data: AdminData = {
    courses: courses ?? [],
    lessons: (lessons ?? []) as AdminData["lessons"],
    quizzes: (quizzes ?? []) as AdminData["quizzes"],
    questions: questions ?? [],
    flashcardSets: flashcardSets ?? [],
    setCourseLinks: setCourseLinks ?? [],
    flashcards: (flashcards ?? []) as AdminData["flashcards"],
    teachers: teachers ?? [],
    events: events ?? [],
    grammarSentences: (grammarSentences ?? []) as AdminData["grammarSentences"],
    verbConjugations: (verbConjugations ?? []) as AdminData["verbConjugations"],
    genderedNouns: (genderedNouns ?? []) as AdminData["genderedNouns"],
    errors: {
      courses: coursesError?.message,
      lessons: lessonsError?.message,
      quizzes: quizzesError?.message,
      questions: questionsError?.message,
      flashcardSets: flashcardSetsError?.message,
      setCourseLinks: setCourseLinksError?.message,
      flashcards: flashcardsError?.message,
      teachers: teachersError?.message,
      events: eventsError?.message,
      grammarSentences: grammarSentencesError?.message,
      verbConjugations: verbConjugationsError?.message,
      genderedNouns: genderedNounsError?.message,
    },
  };

  return <AdminContent data={data} />;
}
