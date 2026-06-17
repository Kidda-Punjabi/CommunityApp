import { FlashcardPlayer } from "@/components/flashcard-player";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

type FlashcardsPageProps = {
  params: Promise<{ lessonId: string }>;
};

export default async function FlashcardsPracticePage({
  params,
}: FlashcardsPageProps) {
  const { lessonId } = await params;
  const supabase = await createClient();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, lesson_number, title, courses(name)")
    .eq("id", lessonId)
    .single();

  if (!lesson) notFound();

  const { data: cards } = await supabase
    .from("flashcards")
    .select("id, front_text, back_text")
    .eq("lesson_id", lessonId)
    .order("created_at");

  if (!cards?.length) {
    return (
      <div className="flex flex-1 flex-col px-4 py-6">
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No flashcards linked to this lesson yet. In admin, assign flashcards to
          this lesson when creating them.
        </p>
        <Link
          href="/dashboard/learn"
          className="mt-4 text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          ← Back to Learn
        </Link>
      </div>
    );
  }

  const course = Array.isArray(lesson.courses) ? lesson.courses[0] : lesson.courses;

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <FlashcardPlayer
        lessonTitle={lesson.title}
        courseName={course?.name ?? "Course"}
        lessonNumber={lesson.lesson_number}
        cards={cards}
      />
    </div>
  );
}
