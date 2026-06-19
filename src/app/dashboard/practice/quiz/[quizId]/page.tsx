import { QuizPlayer } from "@/components/quiz-player";
import { canUserAccessQuiz } from "@/lib/membership/lesson-access";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

type QuizPageProps = {
  params: Promise<{ quizId: string }>;
};

export default async function QuizPracticePage({ params }: QuizPageProps) {
  const { quizId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const access = await canUserAccessQuiz(supabase, user!.id, quizId);

  if (!access.allowed) {
    return (
      <div className="flex flex-1 flex-col px-4 py-6">
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {access.levelLocked
            ? `Complete level ${access.previousLevel} first to unlock this quiz.`
            : `This quiz requires ${access.requiredCourseLabel ?? "a membership upgrade"}.`}
        </p>
        <Link
          href={access.levelLocked ? "/dashboard/games" : "/dashboard/membership"}
          className="mt-4 text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          {access.levelLocked ? "← Back to Practice pathway" : "View membership plans →"}
        </Link>
      </div>
    );
  }

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, title, course_id, level_number, lesson_id, courses(name)")
    .eq("id", quizId)
    .single();

  if (!quiz) notFound();

  let lessonId = quiz.lesson_id as string | null;
  if (!lessonId) {
    const { data: lesson } = await supabase
      .from("lessons")
      .select("id")
      .eq("course_id", quiz.course_id)
      .eq("lesson_number", quiz.level_number)
      .maybeSingle();
    lessonId = lesson?.id ?? null;
  }

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("*")
    .eq("quiz_id", quizId)
    .order("question_order");

  if (!questions?.length) {
    return (
      <div className="flex flex-1 flex-col px-4 py-6">
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This quiz has no questions yet.
        </p>
        <Link
          href="/dashboard/games"
          className="mt-4 text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          ← Back to Practice
        </Link>
      </div>
    );
  }

  const course = Array.isArray(quiz.courses) ? quiz.courses[0] : quiz.courses;

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <Link
        href="/dashboard/games"
        className="mb-4 text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← Back to Practice
      </Link>
      <QuizPlayer
        quizId={quiz.id}
        quizTitle={quiz.title}
        courseName={course?.name ?? "Course"}
        lessonNumber={quiz.level_number}
        lessonId={lessonId}
        questions={questions}
      />
    </div>
  );
}
