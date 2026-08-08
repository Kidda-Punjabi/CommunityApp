import { EnglishModuleActivities } from "@/components/english/english-module-activities";
import { NavLink } from "@/components/ui/nav-link";
import {
  fetchLearnEnglishHomeCourse,
  loadEnglishFoundationsPathItems,
} from "@/lib/learning/english-foundations-path";
import { fetchLearnContent } from "@/lib/learning/load-learn-content";
import {
  getLessonPracticeLinks,
  type FlashcardRow,
  type QuizRow,
  type SetCourseLinkRow,
} from "@/lib/learning/match-lesson-content";
import { filterLessonsForPrivateCourse } from "@/lib/learning/private-courses";
import { fetchLessonCompletionMap } from "@/lib/progress/lesson-completion";
import { fetchQuizProgressMap } from "@/lib/progress/quiz-progress";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";
import { ui } from "@/lib/ui/styles";
import { notFound, redirect } from "next/navigation";

type EnglishLessonPageProps = {
  params: Promise<{ lessonId: string }>;
};

export default async function EnglishFoundationsLessonPage({
  params,
}: EnglishLessonPageProps) {
  const { lessonId } = await params;
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  const { supabase, user } = session;
  const homeCourse = await fetchLearnEnglishHomeCourse(supabase, user.id);
  if (!homeCourse) redirect("/dashboard/profile");

  const [
    allLessons,
    pathItems,
    quizProgressMap,
    { data: flashcardRows },
    { data: setLinks },
    { data: quizRows },
    { data: flashcardSets },
  ] = await Promise.all([
    fetchLearnContent(supabase),
    loadEnglishFoundationsPathItems(supabase, user.id, homeCourse.id),
    fetchQuizProgressMap(supabase, user.id),
    supabase
      .from("flashcards")
      .select("id, lesson_id, deck_id, deck_name, front_text, back_text")
      .eq("lesson_id", lessonId),
    supabase
      .from("set_course_links")
      .select("deck_id, lesson_id, course_id")
      .eq("lesson_id", lessonId),
    supabase
      .from("quizzes")
      .select("id, course_id, level_number, title, lesson_id")
      .eq("course_id", homeCourse.id),
    supabase.from("flashcard_sets").select("id, name"),
  ]);

  const courseLessons = filterLessonsForPrivateCourse(allLessons, homeCourse.id);
  const lesson = courseLessons.find((row) => row.id === lessonId);
  if (!lesson) notFound();

  const pathItem = pathItems.find((item) => item.id === lessonId);
  if (!pathItem || pathItem.status === "locked") {
    redirect("/dashboard/english");
  }

  const setNames = new Map(
    (flashcardSets ?? []).map((set) => [set.id as string, set.name as string])
  );

  const quizzesForPractice: QuizRow[] = (quizRows ?? []).map((quiz) => ({
    id: quiz.id as string,
    course_id: quiz.course_id as string,
    level_number: quiz.level_number as number,
    title: quiz.title as string,
  }));

  // Prefer lesson_id-linked quizzes when present (getLessonPracticeLinks only matches level).
  const directQuiz = (quizRows ?? []).find((quiz) => quiz.lesson_id === lessonId);
  const practice = getLessonPracticeLinks(
    {
      id: lesson.id,
      course_id: lesson.course_id,
      lesson_number: lesson.lesson_number,
    },
    quizzesForPractice,
    (flashcardRows ?? []) as FlashcardRow[],
    (setLinks ?? []) as SetCourseLinkRow[],
    setNames
  );

  let quizId = practice.quizId;
  let quizTitle = practice.quizTitle;
  if (directQuiz) {
    quizId = directQuiz.id as string;
    quizTitle = (directQuiz.title as string) ?? quizTitle;
  }

  let questionCount = 0;
  if (quizId) {
    const { count } = await supabase
      .from("quiz_questions")
      .select("id", { count: "exact", head: true })
      .eq("quiz_id", quizId);
    questionCount = count ?? 0;
  }

  const completionMap = await fetchLessonCompletionMap(
    supabase,
    user.id,
    courseLessons
  );
  const completion = completionMap.get(lesson.id);

  const returnPath = `/dashboard/english/lesson/${lessonId}`;

  return (
    <div className={ui.page}>
      <NavLink
        href="/dashboard/english"
        className="text-sm font-medium text-emerald-700 hover:text-emerald-600"
      >
        ← Back to path
      </NavLink>

      <div className="mt-6">
        <EnglishModuleActivities
          lessonId={lesson.id}
          title={lesson.title}
          completion={completion}
          flashcardSets={practice.flashcardSets}
          quiz={
            quizId
              ? {
                  id: quizId,
                  title: quizTitle ?? "Check",
                  questionCount,
                }
              : null
          }
          quizProgress={quizId ? quizProgressMap.get(quizId) : undefined}
          returnPath={returnPath}
        />
      </div>
    </div>
  );
}
