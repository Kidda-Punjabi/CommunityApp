import { LessonCard } from "@/components/lesson-card";
import { NavLink } from "@/components/ui/nav-link";
import {
  fetchLearnEnglishHomeCourse,
  isEnglishFoundationsLessonComplete,
  loadEnglishFoundationsPathItems,
} from "@/lib/learning/english-foundations-path";
import { fetchLearnContent } from "@/lib/learning/load-learn-content";
import { filterLessonsForPrivateCourse } from "@/lib/learning/private-courses";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";
import { fetchLessonCompletionMap } from "@/lib/progress/lesson-completion";
import { fetchLessonProgressMap } from "@/lib/progress/lesson-progress";
import { fetchFlashcardProgressMap } from "@/lib/progress/flashcard-progress";
import { fetchQuizProgressMap } from "@/lib/progress/quiz-progress";
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
    progressMap,
    flashcardProgressMap,
    quizProgressMap,
  ] = await Promise.all([
    fetchLearnContent(supabase),
    loadEnglishFoundationsPathItems(supabase, user.id, homeCourse.id),
    fetchLessonProgressMap(supabase, user.id),
    fetchFlashcardProgressMap(supabase, user.id),
    fetchQuizProgressMap(supabase, user.id),
  ]);

  const courseLessons = filterLessonsForPrivateCourse(allLessons, homeCourse.id);
  const lesson = courseLessons.find((row) => row.id === lessonId);
  if (!lesson) notFound();

  const pathItem = pathItems.find((item) => item.id === lessonId);
  if (!pathItem || pathItem.status === "locked") {
    redirect("/dashboard/english");
  }

  const completionMap = await fetchLessonCompletionMap(supabase, user.id, courseLessons);
  const completion = completionMap.get(lesson.id);
  const progress = progressMap.get(lesson.id);
  const complete = isEnglishFoundationsLessonComplete(completion, progress);

  return (
    <div className={ui.page}>
      <NavLink
        href="/dashboard/english"
        className="text-sm font-medium text-emerald-700 hover:text-emerald-600"
      >
        ← Back to path
      </NavLink>

      <div className="mt-4">
        <LessonCard
          lesson={lesson}
          accordionName="english-foundations-lesson"
          defaultExpanded
          canBrowse
          contentUnlocked
          visualStatus={complete ? "available" : "in_progress"}
          unitLabel="Lesson"
          progress={
            progress
              ? {
                  audioCompleted: progress.completed,
                  lastPosition: progress.last_position,
                  pdfCompleted: progress.pdf_completed,
                  lastPageViewed: progress.last_page_viewed,
                }
              : undefined
          }
          completion={completion}
          flashcardProgressMap={flashcardProgressMap}
          quizProgressMap={quizProgressMap}
        />
      </div>

    </div>
  );
}
