import Link from "next/link";
import type { LessonWithCourse } from "@/app/dashboard/learn/types";
import { LessonAudioPlayer } from "@/components/lesson-audio-player";
import { LessonPdfViewer } from "@/components/lesson-pdf-viewer";
import { LessonRecordingPlayer } from "@/components/lesson-recording-player";
import {
  LessonCompletionRing,
  LessonRequirementStatus,
  PracticeCompleteBadge,
} from "@/components/lesson-completion-indicator";
import { deckPracticeHref } from "@/lib/flashcards/utils";
import {
  SHOW_LESSON_AUDIO,
  SHOW_LESSON_PDF,
} from "@/lib/learning/lesson-content-flags";
import type { LessonRecordingView } from "@/lib/tutoring/lesson-content-access";
import type { LessonCompletionStatus } from "@/lib/progress/lesson-completion";
import type { FlashcardProgressRow } from "@/lib/progress/flashcard-progress";
import { ui } from "@/lib/ui/styles";

type LessonProgress = {
  audioCompleted: boolean;
  lastPosition: number;
  pdfCompleted: boolean;
  lastPageViewed: number;
};

type LessonCardProps = {
  lesson: LessonWithCourse;
  canBrowse: boolean;
  contentUnlocked: boolean;
  requiredCourseLabel?: string;
  progress?: LessonProgress;
  completion?: LessonCompletionStatus;
  flashcardProgressMap?: Map<string, FlashcardProgressRow>;
  recording?: LessonRecordingView | null;
};

export function LessonCard({
  lesson,
  canBrowse,
  contentUnlocked,
  requiredCourseLabel,
  progress,
  completion,
  flashcardProgressMap,
  recording,
}: LessonCardProps) {
  const hasPresentation = Boolean(lesson.presentation_url);
  const hasPdf = SHOW_LESSON_PDF && Boolean(lesson.pdf_url);
  const hasAudio = SHOW_LESSON_AUDIO && Boolean(lesson.audio_url);
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

  const hasLessonContent =
    hasPresentation || hasPdf || hasAudio || Boolean(recording);

  return (
    <div id={`lesson-${lesson.id}`} className={`scroll-mt-6 ${ui.cardBordered}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            Lesson {lesson.lesson_number}
          </p>
          <h3 className="mt-1 font-semibold text-zinc-900">{lesson.title}</h3>
          {contentUnlocked && completion && <LessonRequirementStatus status={completion} />}
        </div>
        <div className="flex shrink-0 items-start gap-2">
          {contentUnlocked && completion && <LessonCompletionRing status={completion} />}
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

      {!canBrowse && (
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

      {canBrowse && !contentUnlocked && (
        <div className="mt-3 rounded-xl bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-900">
            Your tutor will unlock this lesson after your session. Check back here once it is
            ready.
          </p>
        </div>
      )}

      {contentUnlocked && hasPresentation && (
        <div className="mt-3">
          <p className="mb-2 text-xs font-medium text-zinc-500">Presentation</p>
          <a
            href={lesson.presentation_url!}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex w-full items-center justify-center gap-2 ${ui.btnSecondary}`}
          >
            Open presentation
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      )}

      {contentUnlocked && hasPdf && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-zinc-500">Lesson PDF</p>
          <LessonPdfViewer
            lessonId={lesson.id}
            pdfUrl={lesson.pdf_url!}
            initialLastPage={progress?.lastPageViewed ?? 0}
            initialPdfCompleted={progress?.pdfCompleted ?? false}
          />
        </div>
      )}

      {contentUnlocked && hasAudio && (
        <div className={hasPresentation || hasPdf ? "mt-4 border-t border-zinc-100 pt-4" : "mt-3"}>
          <p className="mb-1.5 text-xs font-medium text-zinc-500">Audio</p>
          <LessonAudioPlayer
            lessonId={lesson.id}
            audioUrl={lesson.audio_url!}
            initialLastPosition={progress?.lastPosition ?? 0}
            initialCompleted={progress?.audioCompleted ?? false}
          />
        </div>
      )}

      {contentUnlocked && recording && <LessonRecordingPlayer recording={recording} />}

      {contentUnlocked && !hasLessonContent && (
        <p className="mt-3 text-sm text-zinc-500">Lesson content coming soon.</p>
      )}

      {contentUnlocked && (hasQuiz || hasFlashcards) && (
        <div className="mt-4 space-y-2 border-t border-zinc-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Practice this lesson
          </p>
          <div className="flex flex-col gap-2">
            {hasQuiz && (
              <Link
                href={`/dashboard/practice/quiz/${quizId}`}
                className="flex items-center justify-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-100"
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
                      className="flex flex-1 items-center justify-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 sm:min-w-[12rem]"
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
