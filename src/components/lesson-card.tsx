import Link from "next/link";
import type { LessonWithCourse } from "@/app/dashboard/learn/types";
import { LessonAudioPlayer } from "@/components/lesson-audio-player";

type LessonProgress = {
  completed: boolean;
  lastPosition: number;
};

type LessonCardProps = {
  lesson: LessonWithCourse;
  canAccess: boolean;
  requiredCourseLabel?: string;
  progress?: LessonProgress;
};

export function LessonCard({ lesson, canAccess, requiredCourseLabel, progress }: LessonCardProps) {
  const hasAudio = Boolean(lesson.audio_url);
  const { quizId, quizTitle, flashcardCount } = lesson.practice;
  const hasQuiz = Boolean(quizId);
  const hasFlashcards = flashcardCount > 0;

  return (
    <div id={`lesson-${lesson.id}`} className="scroll-mt-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            Lesson {lesson.lesson_number}
          </p>
          <h3 className="mt-1 font-semibold text-zinc-900">{lesson.title}</h3>
          {progress?.completed && (
            <p className="mt-1 text-xs font-medium text-green-600">Completed</p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            lesson.is_free
              ? "bg-green-50 text-green-700"
              : "bg-violet-50 text-violet-700"
          }`}
        >
          {lesson.is_free ? "Free" : "Member"}
        </span>
      </div>

      {!canAccess && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-zinc-500">
            Unlock with{" "}
            <span className="font-medium text-zinc-700">
              {requiredCourseLabel ?? "this course"}
            </span>
            .
          </p>
          <Link
            href="/dashboard/membership"
            className="inline-block text-sm font-semibold text-violet-600 hover:text-violet-500"
          >
            View plans →
          </Link>
        </div>
      )}

      {canAccess && hasAudio && (
        <LessonAudioPlayer
          lessonId={lesson.id}
          audioUrl={lesson.audio_url!}
          initialLastPosition={progress?.lastPosition ?? 0}
          initialCompleted={progress?.completed ?? false}
        />
      )}

      {canAccess && !hasAudio && (
        <p className="mt-3 text-sm text-zinc-500">Audio coming soon.</p>
      )}

      {canAccess && (hasQuiz || hasFlashcards) && (
        <div className="mt-4 space-y-2 border-t border-zinc-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Practice this lesson
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            {hasQuiz && (
              <Link
                href={`/dashboard/practice/quiz/${quizId}`}
                className="flex-1 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-center text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-100"
              >
                Go to quiz{quizTitle ? `: ${quizTitle}` : ""}
              </Link>
            )}
            {hasFlashcards && (
              <Link
                href={`/dashboard/practice/flashcards/${lesson.id}`}
                className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-center text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100"
              >
                Go to flashcards ({flashcardCount})
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
