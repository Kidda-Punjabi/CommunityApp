import { DeckProgressBar } from "@/components/deck-progress-bar";
import { QuizPathway } from "@/components/quiz-pathway";
import { canAccessLesson, hasAccessToCourse } from "@/lib/membership/access";
import {
  formatUnlockedCourseNames,
  getCourseAccessContext,
} from "@/lib/membership/unlocked";
import {
  getLessonPracticeLinks,
  type FlashcardRow,
  type QuizRow,
} from "@/lib/learning/match-lesson-content";
import {
  computeDeckConfidenceStats,
  fetchFlashcardProgressMap,
} from "@/lib/progress/flashcard-progress";
import {
  buildQuizLevelPathway,
  fetchQuizProgressMap,
} from "@/lib/progress/quiz-progress";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function PracticePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: courses },
    { data: lessons },
    { data: quizzes },
    { data: flashcards },
  ] = await Promise.all([
    supabase.from("courses").select("id, name, required_tier").order("name"),
    supabase
      .from("lessons")
      .select("id, course_id, lesson_number, title, is_free, courses(name)")
      .order("lesson_number"),
    supabase.from("quizzes").select("id, course_id, level_number, title").order("level_number"),
    supabase
      .from("flashcards")
      .select("id, lesson_id, deck_name, front_text, back_text"),
  ]);

  const access = await getCourseAccessContext(supabase, user!);
  const quizProgressMap = await fetchQuizProgressMap(supabase, user!.id);
  const flashcardProgressMap = await fetchFlashcardProgressMap(supabase, user!.id);

  const quizRows = (quizzes ?? []) as QuizRow[];
  const flashcardRows = (flashcards ?? []) as FlashcardRow[];

  const quizPathways = (courses ?? [])
    .map((course) => {
      const courseQuizzes = quizRows.filter((quiz) => quiz.course_id === course.id);
      if (courseQuizzes.length === 0) return null;

      const hasAccess = hasAccessToCourse(access.unlockedCourseIds, course.id);

      return {
        courseId: course.id,
        courseName: course.name,
        levels: buildQuizLevelPathway(courseQuizzes, quizProgressMap, hasAccess),
        hasAccess,
      };
    })
    .filter((item) => item !== null);

  const flashcardDecks = (lessons ?? [])
    .map((lesson) => {
      const course = Array.isArray(lesson.courses)
        ? lesson.courses[0]
        : lesson.courses;

      const base = {
        id: lesson.id,
        course_id: lesson.course_id,
        lesson_number: lesson.lesson_number,
        title: lesson.title,
        is_free: lesson.is_free,
        courseName: course?.name ?? "Course",
      };

      const practice = getLessonPracticeLinks(base, quizRows, flashcardRows);
      const canAccess = canAccessLesson(access.unlockedCourseIds, lesson);
      const deckCards = flashcardRows.filter((card) => card.lesson_id === lesson.id);

      if (!canAccess || deckCards.length === 0) return null;

      const stats = computeDeckConfidenceStats(
        deckCards.map((card) => card.id),
        flashcardProgressMap
      );

      return { ...base, stats };
    })
    .filter((item) => item !== null);

  const hasContent = quizPathways.length > 0 || flashcardDecks.length > 0;

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Practice</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Work through quiz levels and review flashcard decks.
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Unlocked:{" "}
          <span className="font-semibold text-violet-600">
            {formatUnlockedCourseNames(access.courses, access.unlockedCourseIds)}
          </span>
        </p>
      </div>

      {!hasContent ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
          <span className="text-5xl" role="img" aria-hidden="true">
            ✨
          </span>
          <p className="mt-4 text-lg font-semibold text-zinc-900">
            No practice content available yet
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Unlock a course on the membership page or link practice content in admin.
          </p>
          <Link
            href="/dashboard/membership"
            className="mt-4 text-sm font-medium text-violet-600 hover:text-violet-500"
          >
            View membership plans →
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {quizPathways.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-zinc-900">Quiz pathways</h2>
              {quizPathways.map((pathway) => (
                <div key={pathway.courseId}>
                  {!pathway.hasAccess && (
                    <p className="mb-2 text-sm text-amber-700">
                      Purchase this course to unlock its quiz pathway.
                    </p>
                  )}
                  <QuizPathway
                    courseName={pathway.courseName}
                    levels={pathway.levels}
                  />
                </div>
              ))}
            </section>
          )}

          {flashcardDecks.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-zinc-900">Flashcard decks</h2>
              {flashcardDecks.map((deck) => (
                <div
                  key={deck.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
                    {deck.courseName} · Lesson {deck.lesson_number}
                  </p>
                  <h3 className="mt-1 font-semibold text-zinc-900">{deck.title}</h3>
                  <DeckProgressBar
                    confident={deck.stats.confident}
                    notConfident={deck.stats.notConfident}
                    total={deck.stats.total}
                  />
                  <Link
                    href={`/dashboard/practice/flashcards/${deck.id}`}
                    className="mt-3 inline-block rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
                  >
                    Study deck ({deck.stats.total} cards)
                  </Link>
                </div>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
