import { FlashcardLessonSetsHub } from "@/components/flashcards/lesson-sets-hub";
import {
  FlashcardAccessDenied,
  FlashcardDeckEmpty,
} from "@/components/flashcards/deck-states";
import { loadFlashcardSetsForLesson } from "@/lib/flashcards/load-deck";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

type FlashcardsPageProps = {
  params: Promise<{ lessonId: string }>;
};

export default async function FlashcardsLessonPage({ params }: FlashcardsPageProps) {
  const { lessonId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const result = await loadFlashcardSetsForLesson(supabase, user!.id, lessonId);

  if (result.kind === "not_found") notFound();
  if (result.kind === "forbidden") {
    return <FlashcardAccessDenied requiredCourseLabel={result.requiredCourseLabel ?? null} />;
  }
  if (result.kind === "empty") return <FlashcardDeckEmpty />;

  if (result.sets.length === 1) {
    redirect(`/dashboard/practice/flashcards/${lessonId}/${result.sets[0].deckId}`);
  }

  const course = Array.isArray(result.lesson.courses)
    ? result.lesson.courses[0]
    : result.lesson.courses;

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <FlashcardLessonSetsHub
        lessonId={lessonId}
        lessonTitle={result.lesson.title ?? "Lesson"}
        courseName={course?.name ?? "Course"}
        lessonNumber={result.lesson.lesson_number ?? 0}
        sets={result.sets}
      />
    </div>
  );
}
