import Link from "next/link";
import type { LessonWithCourse } from "@/app/dashboard/learn/types";
import { LessonAudioPlayer } from "@/components/lesson-audio-player";
import { LessonPdfViewer } from "@/components/lesson-pdf-viewer";
import { LessonRecordingPlayer } from "@/components/lesson-recording-player";
import { deckPracticeHref } from "@/lib/flashcards/utils";
import {
  SHOW_LESSON_AUDIO,
  SHOW_LESSON_PDF,
} from "@/lib/learning/lesson-content-flags";
import { HomeworkSubmissionSection } from "@/components/homework/homework-submission-section";
import type { LessonRecordingView } from "@/lib/tutoring/lesson-content-access";
import type { HomeworkSubmissionView } from "@/lib/tutoring/homework-submissions";
import type { LessonCompletionStatus } from "@/lib/progress/lesson-completion";
import type { FlashcardProgressRow } from "@/lib/progress/flashcard-progress";
import { cn, ui } from "@/lib/ui/styles";

type LessonProgress = {
  audioCompleted: boolean;
  lastPosition: number;
  pdfCompleted: boolean;
  lastPageViewed: number;
};

type LessonCardProps = {
  lesson: LessonWithCourse;
  accordionName?: string;
  defaultExpanded?: boolean;
  canBrowse: boolean;
  contentUnlocked: boolean;
  requiredCourseLabel?: string;
  progress?: LessonProgress;
  completion?: LessonCompletionStatus;
  flashcardProgressMap?: Map<string, FlashcardProgressRow>;
  recording?: LessonRecordingView | null;
  homework?: HomeworkSubmissionView | null;
  showHomework?: boolean;
  /** e.g. "Week" for community course; defaults to "Lesson". */
  unitLabel?: string;
};

export function LessonCard({
  lesson,
  accordionName = "learn-lessons",
  defaultExpanded = false,
  canBrowse,
  contentUnlocked,
  requiredCourseLabel,
  progress,
  completion,
  flashcardProgressMap,
  recording,
  homework,
  showHomework = false,
  unitLabel = "Lesson",
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

  const flashcardsDone = hasFlashcards && flashcardSets.every((set) => isSetComplete(set.cardIds));
  const rowButtonClass =
    "inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50";
  const primaryButtonClass =
    "inline-flex items-center justify-center rounded-full bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500";

  const isTutorLocked = canBrowse && !contentUnlocked;

  return (
    <div
      id={`lesson-${lesson.id}`}
      className={cn(
        "scroll-mt-6",
        ui.cardBordered,
        isTutorLocked && "border-zinc-200/70 bg-zinc-100/60 opacity-80"
      )}
    >
      {!canBrowse ? (
        <>
          <LessonCardHeader
            lesson={lesson}
            unitLabel={unitLabel}
            completion={completion}
            flashcardsDone={flashcardsDone}
            quizDone={quizDone}
          />
          <div className="mt-3 space-y-2">
            <p className="text-sm text-zinc-500">
              Unlock with{" "}
              <span className="font-medium text-zinc-700">
                {requiredCourseLabel ?? "this course"}
              </span>
              .
            </p>
            <Link href="/dashboard/membership" className={rowButtonClass}>
              View plans
            </Link>
          </div>
        </>
      ) : isTutorLocked ? (
        <LessonCardHeader
          lesson={lesson}
          unitLabel={unitLabel}
          locked
          muted
          ariaLabel={`${unitLabel} ${lesson.lesson_number}: ${lesson.title}. Locked until your tutor unlocks it.`}
        />
      ) : (
        <details name={accordionName} open={defaultExpanded} className="group">
          <summary className="flex cursor-pointer list-none items-start [&::-webkit-details-marker]:hidden">
            <LessonCardHeader
              lesson={lesson}
              unitLabel={unitLabel}
              completion={completion}
              flashcardsDone={flashcardsDone}
              quizDone={quizDone}
              chevron
            />
          </summary>

          <div className="mt-4 border-t border-zinc-100 pt-2">
            <ContentRow
              label="Presentation"
              subtitle={hasPresentation ? "Slides for this lesson" : "Not available yet"}
              actionLabel="Open"
              disabled={!hasPresentation}
              href={hasPresentation ? lesson.presentation_url! : undefined}
            />
            <ContentRow
              label="Session recording"
              subtitle={recording ? (recording.title ?? "Watch your replay") : "Not available yet"}
              actionLabel="Open"
              disabled={!recording}
              href={recording ? recording.url : undefined}
            />
            {showHomework ? (
              <ContentRow
                label="Homework"
                subtitle={
                  homework?.status === "reviewed"
                    ? homework.approved
                      ? "Reviewed and approved"
                      : "Reviewed with feedback"
                    : homework?.status === "pending_review"
                      ? "Submitted, awaiting review"
                      : "Not submitted yet"
                }
                actionLabel="Open"
              />
            ) : null}
          </div>

          {showHomework ? (
            <div className="mt-3">
              <HomeworkSubmissionSection lessonId={lesson.id} submission={homework ?? null} />
            </div>
          ) : null}

          {(hasQuiz || hasFlashcards) && (
            <div className="mt-4 border-t border-zinc-100 pt-4">
              <p className="text-sm font-medium text-zinc-900">Practice this lesson</p>
              {hasQuiz ? (
                <div className="mt-3">
                  <Link href={`/dashboard/practice/quiz/${quizId}`} className={primaryButtonClass}>
                    Start quiz{quizTitle ? `: ${quizTitle}` : ""}
                  </Link>
                </div>
              ) : null}
              {hasFlashcards ? (
                <div className="mt-3">
                  {flashcardSets.map((set) => (
                    <div key={set.deckId} className="mt-2 first:mt-0">
                      <Link href={deckPracticeHref(lesson.id, set.deckId)} className={rowButtonClass}>
                        {set.name} ({set.cardCount}) {isSetComplete(set.cardIds) ? "reviewed" : ""}
                      </Link>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {contentUnlocked && !hasLessonContent && (
            <p className="mt-3 text-sm text-zinc-500">Lesson content coming soon.</p>
          )}

          {contentUnlocked && hasPdf && (
            <div className="mt-4 border-t border-zinc-100 pt-4">
              <p className="mb-1.5 text-sm text-zinc-500">Lesson PDF</p>
              <LessonPdfViewer
                lessonId={lesson.id}
                pdfUrl={lesson.pdf_url!}
                initialLastPage={progress?.lastPageViewed ?? 0}
                initialPdfCompleted={progress?.pdfCompleted ?? false}
              />
            </div>
          )}

          {contentUnlocked && hasAudio && (
            <div className="mt-4 border-t border-zinc-100 pt-4">
              <p className="mb-1.5 text-sm text-zinc-500">Audio</p>
              <LessonAudioPlayer
                lessonId={lesson.id}
                audioUrl={lesson.audio_url!}
                initialLastPosition={progress?.lastPosition ?? 0}
                initialCompleted={progress?.audioCompleted ?? false}
              />
            </div>
          )}

          {contentUnlocked && recording ? <LessonRecordingPlayer recording={recording} /> : null}
        </details>
      )}
    </div>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className={cn("h-4 w-4 shrink-0", className)}
    >
      <path
        fillRule="evenodd"
        d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function LessonCardHeader({
  lesson,
  unitLabel,
  completion,
  flashcardsDone = false,
  quizDone = false,
  locked = false,
  muted = false,
  chevron = false,
  ariaLabel,
}: {
  lesson: LessonWithCourse;
  unitLabel: string;
  completion?: LessonCompletionStatus;
  flashcardsDone?: boolean;
  quizDone?: boolean;
  locked?: boolean;
  muted?: boolean;
  chevron?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3" aria-label={ariaLabel}>
      {locked ? (
        <LockIcon className="mt-1 text-zinc-400" />
      ) : null}
      <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-xs font-medium",
              muted ? "text-zinc-400" : "text-violet-600"
            )}
          >
            {unitLabel} {lesson.lesson_number}
          </p>
          <h3
            className={cn(
              "mt-1 text-lg font-medium",
              muted ? "text-zinc-500" : "text-zinc-900"
            )}
          >
            {lesson.title}
          </h3>
          {!locked ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              {completion ? (
                <span>
                  {completion.partsDone} of {completion.partsTotal} complete
                </span>
              ) : null}
              {lesson.is_free ? (
                <span className="rounded-full border border-zinc-200 px-2 py-0.5">Free</span>
              ) : null}
            </div>
          ) : null}
        </div>
        {!locked ? (
          <div className="flex shrink-0 items-center gap-2">
            <StateBadge label="Flashcards" done={flashcardsDone} muted={muted} />
            <StateBadge label="Quiz" done={quizDone} muted={muted} />
            {chevron ? (
              <span className="text-zinc-400 transition-transform duration-200 group-open:rotate-180">
                ⌄
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StateBadge({
  label,
  done,
  muted = false,
}: {
  label: string;
  done: boolean;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
        done
          ? muted
            ? "border-zinc-200 bg-zinc-100 text-zinc-500"
            : "border-green-200 bg-green-50 text-green-700"
          : "border-zinc-200 bg-white text-zinc-600"
      )}
    >
      {done ? "✓" : ""}
      {label}
    </span>
  );
}

function ContentRow({
  label,
  subtitle,
  actionLabel,
  href,
  disabled = false,
}: {
  label: string;
  subtitle?: string;
  actionLabel: string;
  href?: string;
  disabled?: boolean;
}) {
  const buttonClass = cn(
    "inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors",
    disabled ? "cursor-not-allowed opacity-50" : "hover:bg-zinc-50"
  );

  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-100 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-900">{label}</p>
        {subtitle ? <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p> : null}
      </div>
      {href && !disabled ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={buttonClass}>
          {actionLabel}
        </a>
      ) : (
        <button type="button" className={buttonClass} disabled={disabled}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
