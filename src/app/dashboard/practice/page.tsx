import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  getLessonPracticeLinks,
  type FlashcardRow,
  type QuizRow,
} from "@/lib/learning/match-lesson-content";

export default async function PracticePage() {
  const supabase = await createClient();

  const [{ data: lessons }, { data: quizzes }, { data: flashcards }] =
    await Promise.all([
      supabase
        .from("lessons")
        .select("id, course_id, lesson_number, title, courses(name)")
        .order("lesson_number"),
      supabase.from("quizzes").select("id, course_id, level_number, title"),
      supabase
        .from("flashcards")
        .select("id, lesson_id, deck_name, front_text, back_text"),
    ]);

  const quizRows = (quizzes ?? []) as QuizRow[];
  const flashcardRows = (flashcards ?? []) as FlashcardRow[];

  const practiceItems = (lessons ?? [])
    .map((lesson) => {
      const course = Array.isArray(lesson.courses)
        ? lesson.courses[0]
        : lesson.courses;

      const base = {
        id: lesson.id,
        course_id: lesson.course_id,
        lesson_number: lesson.lesson_number,
        title: lesson.title,
        courseName: course?.name ?? "Course",
      };

      const practice = getLessonPracticeLinks(base, quizRows, flashcardRows);

      return { ...base, practice };
    })
    .filter(
      (item) => item.practice.quizId || item.practice.flashcardCount > 0
    );

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Practice</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Quizzes and flashcards linked to your lessons.
        </p>
      </div>

      {practiceItems.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
          <span className="text-5xl" role="img" aria-hidden="true">
            ✨
          </span>
          <p className="mt-4 text-lg font-semibold text-zinc-900">
            No practice content yet
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Add quizzes and flashcards in admin and link them to a lesson.
          </p>
          <Link
            href="/dashboard/learn"
            className="mt-4 text-sm font-medium text-violet-600 hover:text-violet-500"
          >
            Go to Learn →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {practiceItems.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
                {item.courseName} · Lesson {item.lesson_number}
              </p>
              <h2 className="mt-1 font-semibold text-zinc-900">{item.title}</h2>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                {item.practice.quizId && (
                  <Link
                    href={`/dashboard/practice/quiz/${item.practice.quizId}`}
                    className="flex-1 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-center text-sm font-semibold text-violet-700 hover:bg-violet-100"
                  >
                    Take quiz
                  </Link>
                )}
                {item.practice.flashcardCount > 0 && (
                  <Link
                    href={`/dashboard/practice/flashcards/${item.id}`}
                    className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-center text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
                  >
                    Study flashcards ({item.practice.flashcardCount})
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
