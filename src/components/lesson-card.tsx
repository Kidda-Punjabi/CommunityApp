import Link from "next/link";
import type { LessonWithCourse } from "@/app/dashboard/learn/types";
import { LessonAudioPlayer } from "@/components/lesson-audio-player";
import { LessonPdfViewer } from "@/components/lesson-pdf-viewer";
import {
  LessonCompletionRing,
  LessonRequirementStatus,
  PracticeCompleteBadge,
} from "@/components/lesson-completion-indicator";
import { deckPracticeHref } from "@/lib/flashcards/utils";
import type { LessonCompletionStatus } from "@/lib/progress/lesson-completion";
import type { FlashcardProgressRow } from "@/lib/progress/flashcard-progress";

type LessonProgress = {
  audioCompleted: boolean;
  lastPosition: number;
  pdfCompleted: boolean;
  lastPageViewed: number;
};

type LessonCardProps = {
  lesson: LessonWithCourse;
  canAccess: boolean;
  requiredCourseLabel?: string;
  progress?: LessonProgress;
  completion?: LessonCompletionStatus;
  flashcardProgressMap?: Map<string, FlashcardProgressRow>;
};

export function LessonCard({
  lesson,
  canAccess,
  requiredCourseLabel,
  progress,
  completion,
  flashcardProgressMap,
}: LessonCardProps) {
  const hasPdf = Boolean(lesson.pdf_url);
  const hasAudio = Boolean(lesson.audio_url);
  const { quizId, quizTitle, flashcardSets } = lesson.practice;
  const hasQuiz = Boolean(quizId);
  const hasFlashcards = flashcardSets.length > 0;

  function isSetComplete(cardIds: string[]) {
    if (!flashcardProgressMap || cardIds.length === 0) return false;
    return cardIds.every(
      (cardId) => flashcardProgressMap.get(cardId)?.confidence === "confident"
    );
  }

  const quizDone = Boolean(completion?.quizRequired && completion.quizComplete);
  const pdfDone = Boolean(completion?.pdfRequired && completion.pdfComplete);
  const audioDone = Boolean(completion?.audioRequired && completion.audioComplete);

  return (
    <div id={`lesson-${lesson.id}`} className="scroll-mt-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            Lesson {lesson.lesson_number}
          </p>
          <h3 className="mt-1 font-semibold text-zinc-900">{lesson.title}</h3>
          {canAccess && completion && <LessonRequirementStatus status={completion} />}
        </div>
        <div className="flex shrink-0 items-start gap-2">
          {canAccess && completion && <LessonCompletionRing status={completion} />}
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              lesson.is_free
                ? "bg-green-50 text-green-700"
                : "bg-violet-50 text-violet-700"
            }`}
          >
            {lesson.is_free ? "Free" : "Member"}
          </span>
        </div>
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

      {canAccess && hasPdf && (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-zinc-500">Lesson PDF</span>
            {pdfDone && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-100 text-[10px] leading-none">
                  ✓
                </span>
                Completed
              </span>
            )}
          </div>
          <LessonPdfViewer
            lessonId={lesson.id}
            pdfUrl={lesson.pdf_url!}
            initialLastPage={progress?.lastPageViewed ?? 0}
            initialPdfCompleted={progress?.pdfCompleted ?? false}
          />
        </div>
      )}

      {canAccess && hasAudio && (
        <div className={hasPdf ? "mt-4 border-t border-zinc-100 pt-4" : "mt-3"}>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-zinc-500">
              {hasPdf ? "Listen along" : "Audio"}
            </span>
            {audioDone && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-100 text-[10px] leading-none">
                  ✓
                </span>
                Completed
              </span>
            )}
          </div>
          <LessonAudioPlayer
            lessonId={lesson.id}
            audioUrl={lesson.audio_url!}
            initialLastPosition={progress?.lastPosition ?? 0}
            initialCompleted={progress?.audioCompleted ?? false}
          />
        </div>
      )}

      {canAccess && !hasPdf && !hasAudio && (
        <p className="mt-3 text-sm text-zinc-500">Lesson content coming soon.</p>
      )}

      {canAccess && (hasQuiz || hasFlashcards) && (
        <div className="mt-4 space-y-2 border-t border-zinc-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Practice this lesson
          </p>
          <div className="flex flex-col gap-2">
            {hasQuiz && (
              <Link
                href={`/dashboard/practice/quiz/${quizId}`}
                className="flex items-center justify-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-100"
              >
                <span className="min-w-0 truncate">
                  Go to quiz{quizTitle ? `: ${quizTitle}` : ""}
                </span>
                {quizDone && <PracticeCompleteBadge />}
              </Link>
            )}
            {hasFlashcards && (
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {flashcardSets.map((set) => {
                  const setComplete = isSetComplete(set.cardIds);

                  return (
                    <Link
                      key={set.deckId}
                      href={deckPracticeHref(lesson.id, set.deckId)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 sm:min-w-[12rem]"
                    >
                      <span className="min-w-0 truncate">
                        {set.name} ({set.cardCount})
                      </span>
                      {setComplete && <PracticeCompleteBadge />}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
