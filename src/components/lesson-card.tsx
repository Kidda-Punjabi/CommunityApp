import Link from "next/link";
import { LessonInlineAudioRow } from "@/components/lesson-inline-audio-row";
import type { LessonWithCourse } from "@/app/dashboard/learn/types";
import { RescheduleRequestForm } from "@/components/schedule/reschedule-request-form";
import { CohortSwitchRequestForm } from "@/components/schedule/upcoming-lessons-list";
import { CancelCohortSwitchRequestControl } from "@/components/schedule/cancel-cohort-switch-request-control";
import { LessonPdfViewer } from "@/components/lesson-pdf-viewer";
import { deckPracticeHref } from "@/lib/flashcards/utils";
import {
  SHOW_LESSON_AUDIO,
  SHOW_LESSON_PDF,
} from "@/lib/learning/lesson-content-flags";
import { LessonActivityTiles } from "@/components/lesson/lesson-activity-tiles";
import {
  LessonHomeworkIcon,
  LessonQuizIcon,
} from "@/components/lesson/lesson-activity-icons";
import type { LessonRecordingView } from "@/lib/tutoring/lesson-content-access";
import type { HomeworkSubmissionView } from "@/lib/tutoring/homework-submissions";
import type { LessonCompletionStatus } from "@/lib/progress/lesson-completion";
import type { FlashcardProgressRow } from "@/lib/progress/flashcard-progress";
import type { QuizProgressRow } from "@/lib/progress/quiz-progress";
import type { StudentScheduledSession } from "@/lib/calendar/types";
import type { FlashcardSetInfo } from "@/lib/learning/match-lesson-content";
import { formatSessionWhen } from "@/lib/calendar/reschedule-policy";
import { pressableClass } from "@/lib/ui/pressable";
import { cn, ui } from "@/lib/ui/styles";

export const lessonContentRowButtonClass = cn(
  pressableClass,
  "inline-flex shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
);

/** Display-only: strip trailing week markers that duplicate the W{N} chip. */
export function formatLessonCardTitle(title: string): string {
  return title
    .replace(/\s*[-–—]\s*Week\s*\d+\s*$/i, "")
    .replace(/\s*\(\s*Week\s*\d+\s*\)\s*$/i, "")
    .trim();
}

function LessonWeekTag({ weekNumber }: { weekNumber: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-md border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums leading-none text-zinc-600"
      aria-label={`Week ${weekNumber}`}
    >
      W{weekNumber}
    </span>
  );
}

export type LessonVisualStatus =
  | "in_progress"
  | "next_up"
  | "locked"
  | "rescheduled"
  | "available";

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
  visualStatus?: LessonVisualStatus;
  requiredCourseLabel?: string;
  progress?: LessonProgress;
  completion?: LessonCompletionStatus;
  flashcardProgressMap?: Map<string, FlashcardProgressRow>;
  quizProgressMap?: Map<string, QuizProgressRow>;
  recording?: LessonRecordingView | null;
  homework?: HomeworkSubmissionView | null;
  /** Tutor mark from cohort_lesson_homework.completed (group tracks). */
  homeworkCompleted?: boolean;
  showHomework?: boolean;
  /** e.g. "Week" for community course; defaults to "Lesson". */
  unitLabel?: string;
  hasCatchupSegments?: boolean;
  hasSubmittedFeedback?: boolean;
  homeworkCatchupReturn?: string | null;
  scheduleSession?: StudentScheduledSession | null;
};

export function LessonCard({
  lesson,
  accordionName = "learn-lessons",
  defaultExpanded = false,
  canBrowse,
  contentUnlocked,
  visualStatus = "available",
  requiredCourseLabel,
  progress,
  completion,
  flashcardProgressMap,
  quizProgressMap,
  recording,
  homework,
  homeworkCompleted = false,
  showHomework = false,
  unitLabel = "Lesson",
  hasCatchupSegments = false,
  hasSubmittedFeedback = false,
  homeworkCatchupReturn = null,
  scheduleSession = null,
}: LessonCardProps) {
  const hasPresentation = Boolean(lesson.presentation_url);
  const hasPdf = SHOW_LESSON_PDF && Boolean(lesson.pdf_url);
  const hasApprovedGeneratedAudio =
    Boolean(lesson.audio_url) &&
    (lesson.generated_audio_status === "approved" ||
      (SHOW_LESSON_AUDIO && (lesson.generated_audio_status ?? "none") === "none"));
  const hasLegacyAudioSection = SHOW_LESSON_AUDIO && Boolean(lesson.audio_url) && !hasApprovedGeneratedAudio;
  const { quizId, flashcardSets } = lesson.practice;
  const hasQuiz = Boolean(quizId);
  const hasFlashcards = flashcardSets.length > 0;

  function isSetComplete(cardIds: string[]) {
    if (!flashcardProgressMap || cardIds.length === 0) return false;
    return cardIds.every(
      (cardId) => flashcardProgressMap.get(cardId)?.confidence === "confident"
    );
  }

  const quizProgress = quizId ? quizProgressMap?.get(quizId) : undefined;
  const quizTile = hasQuiz
    ? getQuizTileState(quizProgress, Boolean(completion?.quizComplete))
    : null;
  const flashcardsTile = hasFlashcards
    ? getFlashcardsTileState(lesson.id, flashcardSets, isSetComplete)
    : null;

  const hasLessonContent =
    hasPresentation || hasPdf || hasApprovedGeneratedAudio || hasLegacyAudioSection || Boolean(recording);

  const isTutorLocked = canBrowse && !contentUnlocked;
  const scheduleDisplay = getScheduleDisplay(scheduleSession);
  // Locked wins over rescheduled for the status dot — reschedule is shown via date colour.
  const status: LessonVisualStatus = isTutorLocked
    ? visualStatus === "next_up"
      ? "next_up"
      : "locked"
    : scheduleDisplay?.isRescheduled
      ? "rescheduled"
      : visualStatus;

  if (!canBrowse) {
    return (
      <div id={`lesson-${lesson.id}`} className={cn("scroll-mt-6", ui.cardBordered)}>
        <div className="flex items-center gap-3">
          <LessonStatusDot status="locked" />
          <LessonWeekTag weekNumber={lesson.lesson_number} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-500">
              {formatLessonCardTitle(lesson.title)}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Unlock with {requiredCourseLabel ?? "this course"}.
            </p>
          </div>
          <Link href="/dashboard/membership" className={lessonContentRowButtonClass}>
            View plans
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      id={`lesson-${lesson.id}`}
      className={cn(
        "scroll-mt-6",
        ui.cardBordered,
        isTutorLocked && "border-zinc-200/80 bg-zinc-50/80"
      )}
    >
      <details name={accordionName} open={defaultExpanded} className="group">
        <summary className="flex w-full cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
          <LessonStatusDot status={status} />
          <LessonWeekTag weekNumber={lesson.lesson_number} />
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "truncate text-sm font-medium",
                isTutorLocked ? "text-zinc-500" : "text-zinc-900"
              )}
            >
              {formatLessonCardTitle(lesson.title)}
            </p>
          </div>
          {scheduleDisplay ? (
            <span
              className={cn(
                "shrink-0 text-xs font-medium max-sm:max-w-[5.5rem] max-sm:truncate",
                scheduleDisplay.isRescheduled
                  ? "text-teal-700"
                  : isTutorLocked
                    ? "text-zinc-500"
                    : "text-violet-700"
              )}
            >
              {formatCollapsedDate(scheduleDisplay.startsAt)}
            </span>
          ) : null}
          {isTutorLocked ? (
            <LockIcon className="text-zinc-400" />
          ) : (
            <CollapsedActivityStatus
              showHomework={showHomework}
              homeworkDone={homeworkCompleted}
              showQuiz={hasQuiz}
              quizDone={Boolean(completion?.quizComplete)}
            />
          )}
          <ChevronToggleIcon />
        </summary>

        <div className="mt-4 border-t border-zinc-100 pt-2">
          <LessonScheduleBlock scheduleSession={scheduleSession} />

          {isTutorLocked ? (
            <p className="mt-3 text-sm text-zinc-500">
              Content unlocks after your tutor opens this lesson.
            </p>
          ) : (
            <>
              <LessonActivityTiles
                presentationUrl={hasPresentation ? lesson.presentation_url! : null}
                recordingUrl={recording?.url ?? null}
                recordingTitle={recording?.title ?? null}
                showHomework={showHomework}
                homework={homework ?? null}
                lessonId={lesson.id}
                homeworkCatchupReturn={homeworkCatchupReturn}
                quiz={
                  quizTile && quizId
                    ? {
                        href: `/dashboard/practice/quiz/${quizId}`,
                        statusLabel: quizTile.statusLabel,
                        tone: quizTile.tone,
                      }
                    : null
                }
                flashcards={flashcardsTile}
                hasSubmittedFeedback={hasSubmittedFeedback}
                catchupHref={hasCatchupSegments ? `/catchup/${lesson.id}` : null}
              />

              {contentUnlocked && hasApprovedGeneratedAudio && lesson.audio_url ? (
                <LessonInlineAudioRow
                  lessonId={lesson.id}
                  audioUrl={lesson.audio_url}
                  initialLastPosition={progress?.lastPosition ?? 0}
                  initialCompleted={progress?.audioCompleted ?? false}
                />
              ) : null}

              {contentUnlocked && !hasLessonContent ? (
                <p className="mt-3 text-sm text-zinc-500">Lesson content coming soon.</p>
              ) : null}

              {contentUnlocked && hasPdf ? (
                <div className="mt-4 border-t border-zinc-100 pt-4">
                  <p className="mb-1.5 text-sm text-zinc-500">Lesson PDF</p>
                  <LessonPdfViewer
                    lessonId={lesson.id}
                    pdfUrl={lesson.pdf_url!}
                    initialLastPage={progress?.lastPageViewed ?? 0}
                    initialPdfCompleted={progress?.pdfCompleted ?? false}
                  />
                </div>
              ) : null}

              {contentUnlocked && hasLegacyAudioSection ? (
                <div className="mt-4 border-t border-zinc-100 pt-4">
                  <p className="mb-1.5 text-sm text-zinc-500">Audio</p>
                  <LessonInlineAudioRow
                    lessonId={lesson.id}
                    audioUrl={lesson.audio_url!}
                    initialLastPosition={progress?.lastPosition ?? 0}
                    initialCompleted={progress?.audioCompleted ?? false}
                  />
                </div>
              ) : null}
            </>
          )}

          <LessonScheduleRequestSection scheduleSession={scheduleSession} />
        </div>
      </details>
    </div>
  );
}

export function LessonStatusDot({ status }: { status: LessonVisualStatus }) {
  if (status === "in_progress") {
    return <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-violet-600" aria-hidden="true" />;
  }
  if (status === "next_up") {
    return (
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-violet-500 bg-white"
        aria-hidden="true"
      />
    );
  }
  if (status === "rescheduled") {
    return (
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-zinc-400 bg-zinc-300"
        aria-hidden="true"
        title="Rescheduled"
      />
    );
  }
  if (status === "locked") {
    return (
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-zinc-300 bg-white"
        aria-hidden="true"
      />
    );
  }
  return <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-zinc-300" aria-hidden="true" />;
}

type ScheduleDisplay = {
  isRescheduled: boolean;
  startsAt: string;
  endsAt: string;
  cohortOrTutorLine: string;
};

function getScheduleDisplay(
  scheduleSession?: StudentScheduledSession | null
): ScheduleDisplay | null {
  if (!scheduleSession) return null;

  const isGroup = Boolean(scheduleSession.cohort_id);
  const switchRequest = scheduleSession.cohortSwitchRequest;
  const rescheduleRequest = scheduleSession.rescheduleRequest;

  if (
    switchRequest?.status === "approved" &&
    switchRequest.toSessionStartsAt &&
    switchRequest.toSessionEndsAt
  ) {
    return {
      isRescheduled: true,
      startsAt: switchRequest.toSessionStartsAt,
      endsAt: switchRequest.toSessionEndsAt,
      cohortOrTutorLine: switchRequest.toCohortName
        ? `${switchRequest.toCohortName} (alternate cohort)`
        : `Alternate session with ${scheduleSession.tutorName}`,
    };
  }

  if (rescheduleRequest?.status === "approved") {
    return {
      isRescheduled: true,
      startsAt: scheduleSession.starts_at,
      endsAt: scheduleSession.ends_at,
      cohortOrTutorLine: isGroup
        ? `${scheduleSession.cohortName ?? "Group session"} with ${scheduleSession.tutorName}`
        : `1-to-1 with ${scheduleSession.tutorName}`,
    };
  }

  return {
    isRescheduled: false,
    startsAt: scheduleSession.starts_at,
    endsAt: scheduleSession.ends_at,
    cohortOrTutorLine: isGroup
      ? `${scheduleSession.cohortName ?? "Group session"} with ${scheduleSession.tutorName}`
      : `1-to-1 with ${scheduleSession.tutorName}`,
  };
}

function formatCollapsedDate(startsAtIso: string): string {
  return new Date(startsAtIso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function getQuizTileState(
  progress: QuizProgressRow | undefined,
  passed: boolean
): { statusLabel: string; tone: "accent" | "success" | "neutral" } {
  if (!progress?.completed) {
    return { statusLabel: "Start", tone: "neutral" };
  }
  if (passed) {
    return { statusLabel: "Passed", tone: "success" };
  }
  return { statusLabel: "Retry", tone: "accent" };
}

function getFlashcardsTileState(
  lessonId: string,
  flashcardSets: FlashcardSetInfo[],
  isSetComplete: (cardIds: string[]) => boolean
): { href: string; statusLabel: string; tone: "accent" | "success" | "neutral" } {
  const allComplete = flashcardSets.every((set) => isSetComplete(set.cardIds));
  const targetSet =
    flashcardSets.find((set) => !isSetComplete(set.cardIds)) ?? flashcardSets[0];

  return {
    href: deckPracticeHref(lessonId, targetSet.deckId),
    statusLabel: allComplete ? "Done" : "Start",
    tone: allComplete ? "success" : "neutral",
  };
}

function CollapsedActivityStatus({
  showHomework,
  homeworkDone,
  showQuiz,
  quizDone,
}: {
  showHomework: boolean;
  homeworkDone: boolean;
  showQuiz: boolean;
  quizDone: boolean;
}) {
  if (!showHomework && !showQuiz) return null;

  const doneClass = "text-emerald-600";
  const homeworkPendingClass = "text-violet-600";
  const quizPendingClass = "text-amber-500";

  return (
    <span className="inline-flex shrink-0 items-center gap-1.5" aria-hidden="true">
      {showHomework ? (
        <span
          className={cn(
            "[&_svg]:h-3.5 [&_svg]:w-3.5",
            homeworkDone ? doneClass : homeworkPendingClass
          )}
          title={homeworkDone ? "Homework complete" : "Homework pending"}
        >
          <LessonHomeworkIcon />
        </span>
      ) : null}
      {showQuiz ? (
        <span
          className={cn("[&_svg]:h-3.5 [&_svg]:w-3.5", quizDone ? doneClass : quizPendingClass)}
          title={quizDone ? "Quiz passed" : "Quiz not passed"}
        >
          <LessonQuizIcon />
        </span>
      ) : null}
    </span>
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

function ChevronToggleIcon() {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-violet-600 transition-colors group-hover:border-violet-200"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-4 w-4 transition-transform duration-200 group-open:rotate-180"
      >
        <path
          fillRule="evenodd"
          d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}

function LessonScheduleBlock({
  scheduleSession,
}: {
  scheduleSession?: StudentScheduledSession | null;
}) {
  const display = getScheduleDisplay(scheduleSession);
  if (!scheduleSession || !display) return null;

  return (
    <div
      className={cn(
        "mt-1 rounded-2xl px-4 py-3 text-sm",
        display.isRescheduled ? "bg-teal-50/80" : "bg-violet-50/70"
      )}
    >
      <p className="font-medium text-zinc-900">
        {display.isRescheduled ? "Rescheduled live lesson: " : "Upcoming live lesson: "}
        <span className={display.isRescheduled ? "text-teal-800" : undefined}>
          {formatSessionWhen(display.startsAt, display.endsAt)}
        </span>
      </p>
      <p className="mt-1 text-zinc-600">{display.cohortOrTutorLine}</p>

      {scheduleSession.rescheduleRequest?.status === "pending" ? (
        <p className="mt-3 text-violet-900">
          Reschedule request pending
          {scheduleSession.rescheduleRequest.preferred_times
            ? ` — requested ${scheduleSession.rescheduleRequest.preferred_times}`
            : ""}
          .
        </p>
      ) : null}

      {scheduleSession.cohortSwitchRequest?.status === "pending" ? (
        <CancelCohortSwitchRequestControl
          request={scheduleSession.cohortSwitchRequest}
          className="mt-3"
          compact
        />
      ) : null}

      {scheduleSession.cohortSwitchRequest?.status === "approved" ||
      scheduleSession.rescheduleRequest?.status === "approved" ? (
        <p className="mt-3 text-teal-900">This lesson has been rescheduled.</p>
      ) : null}
    </div>
  );
}

function LessonScheduleRequestSection({
  scheduleSession,
}: {
  scheduleSession?: StudentScheduledSession | null;
}) {
  if (!scheduleSession) return null;

  const isGroup = Boolean(scheduleSession.cohort_id);

  if (scheduleSession.canRequestReschedule) {
    return (
      <div className="mt-4 border-t border-zinc-100 pt-4">
        <p className="text-xs text-zinc-500">
          Need a different time? Ask now and your tutor can move this lesson to a free slot.
        </p>
        <RescheduleRequestForm sessionId={scheduleSession.id} />
      </div>
    );
  }

  if (!isGroup && scheduleSession.rescheduleLockedReason && !scheduleSession.rescheduleRequest) {
    return (
      <div className="mt-4 border-t border-zinc-100 pt-4">
        <button
          type="button"
          disabled
          className={cn(
            lessonContentRowButtonClass,
            "cursor-not-allowed opacity-60 hover:bg-white"
          )}
        >
          Request to reschedule
        </button>
        <p className="mt-2 text-xs text-zinc-500">{scheduleSession.rescheduleLockedReason}</p>
      </div>
    );
  }

  if (scheduleSession.canRequestCohortSwitch) {
    return (
      <div className="mt-4 border-t border-zinc-100 pt-4">
        <p className="text-xs text-zinc-500">
          Can&apos;t make this group? Request a matching alternate cohort session here.
        </p>
        <CohortSwitchRequestForm session={scheduleSession} />
      </div>
    );
  }

  if (isGroup && scheduleSession.cohortSwitchLockedReason && !scheduleSession.cohortSwitchRequest) {
    return (
      <div className="mt-4 border-t border-zinc-100 pt-4">
        <button
          type="button"
          disabled
          className={cn(
            lessonContentRowButtonClass,
            "cursor-not-allowed opacity-60 hover:bg-white"
          )}
        >
          Request alternate cohort
        </button>
        <p className="mt-2 text-xs text-zinc-500">{scheduleSession.cohortSwitchLockedReason}</p>
      </div>
    );
  }

  return null;
}
