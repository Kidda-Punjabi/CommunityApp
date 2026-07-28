import Link from "next/link";
import { NavLink } from "@/components/ui/nav-link";
import { LessonInlineAudioRow } from "@/components/lesson-inline-audio-row";
import type { LessonWithCourse } from "@/app/dashboard/learn/types";
import {
  CohortSwitchRequestForm,
  RescheduleRequestForm,
} from "@/components/schedule/upcoming-lessons-list";
import { LessonPdfViewer } from "@/components/lesson-pdf-viewer";
import { deckPracticeHref } from "@/lib/flashcards/utils";
import {
  SHOW_LESSON_AUDIO,
  SHOW_LESSON_PDF,
} from "@/lib/learning/lesson-content-flags";
import { HomeworkSubmissionSection } from "@/components/homework/homework-submission-section";
import { LessonPresentationEmbed } from "@/components/lesson/lesson-presentation-embed";
import { LessonRecordingPlayer } from "@/components/lesson/lesson-recording-player";
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
  quizProgressMap?: Map<string, QuizProgressRow>;
  recording?: LessonRecordingView | null;
  homework?: HomeworkSubmissionView | null;
  showHomework?: boolean;
  /** e.g. "Week" for community course; defaults to "Lesson". */
  unitLabel?: string;
  hasCatchupSegments?: boolean;
  homeworkCatchupReturn?: string | null;
  scheduleSession?: StudentScheduledSession | null;
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
  quizProgressMap,
  recording,
  homework,
  showHomework = false,
  unitLabel = "Lesson",
  hasCatchupSegments = false,
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
  const { quizId, quizTitle, flashcardSets } = lesson.practice;
  const hasQuiz = Boolean(quizId);
  const hasFlashcards = flashcardSets.length > 0;

  function isSetComplete(cardIds: string[]) {
    if (!flashcardProgressMap || cardIds.length === 0) return false;
    return cardIds.every(
      (cardId) => flashcardProgressMap.get(cardId)?.confidence === "confident"
    );
  }

  const quizProgress = quizId ? quizProgressMap?.get(quizId) : undefined;
  const quizRow = hasQuiz
    ? getQuizRowState(quizTitle, quizProgress, Boolean(completion?.quizComplete))
    : null;
  const flashcardsRow = hasFlashcards
    ? getFlashcardsRowState(lesson.id, flashcardSets, isSetComplete)
    : null;

  const hasLessonContent =
    hasPresentation || hasPdf || hasApprovedGeneratedAudio || hasLegacyAudioSection || Boolean(recording);

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
            scheduleSession={scheduleSession}
          />
          <LessonScheduleBlock scheduleSession={scheduleSession} />
          <div className="mt-3 space-y-2">
            <p className="text-sm text-zinc-500">
              Unlock with{" "}
              <span className="font-medium text-zinc-700">
                {requiredCourseLabel ?? "this course"}
              </span>
              .
            </p>
            <Link href="/dashboard/membership" className={lessonContentRowButtonClass}>
              View plans
            </Link>
          </div>
        </>
      ) : isTutorLocked ? (
        <>
          <LessonCardHeader
            lesson={lesson}
            unitLabel={unitLabel}
            locked
            muted
            ariaLabel={`${unitLabel} ${lesson.lesson_number}: ${lesson.title}. Locked until your tutor unlocks it.`}
            scheduleSession={scheduleSession}
          />
          <LessonScheduleBlock scheduleSession={scheduleSession} />
        </>
      ) : (
        <details name={accordionName} open={defaultExpanded} className="group">
          <summary className="flex w-full cursor-pointer list-none items-center [&::-webkit-details-marker]:hidden">
            <LessonCardHeader
              lesson={lesson}
              unitLabel={unitLabel}
              completion={completion}
              chevron
              scheduleSession={scheduleSession}
            />
          </summary>

          <div className="mt-4 border-t border-zinc-100 pt-2">
            <LessonScheduleBlock scheduleSession={scheduleSession} />
            {contentUnlocked && hasPresentation ? (
              <div className="border-b border-zinc-100 py-3">
                <LessonPresentationEmbed presentationUrl={lesson.presentation_url!} />
              </div>
            ) : (
              <ContentRow
                label="Presentation"
                subtitle={hasPresentation ? "Slides for this lesson" : "Not available yet"}
                actionLabel="Open"
                disabled={!hasPresentation}
              />
            )}
            {contentUnlocked && recording ? (
              <div className="border-b border-zinc-100 py-3">
                <LessonRecordingPlayer url={recording.url} title={recording.title} />
              </div>
            ) : (
              <ContentRow
                label="Session recording"
                subtitle={recording ? (recording.title ?? "Watch your replay") : "Not available yet"}
                actionLabel="Open"
                disabled={!recording}
              />
            )}
            {hasCatchupSegments ? (
              <ContentRow
                label="Catch-up lesson"
                subtitle="Self-paced review before your next live session"
                actionLabel="Start"
                href={`/catchup/${lesson.id}`}
              />
            ) : null}
            {showHomework ? (
              <HomeworkSubmissionSection
                lessonId={lesson.id}
                submission={homework ?? null}
                variant="integrated"
                catchupReturn={homeworkCatchupReturn}
              />
            ) : null}
            {contentUnlocked && hasApprovedGeneratedAudio && lesson.audio_url ? (
              <LessonInlineAudioRow
                lessonId={lesson.id}
                audioUrl={lesson.audio_url}
                initialLastPosition={progress?.lastPosition ?? 0}
                initialCompleted={progress?.audioCompleted ?? false}
              />
            ) : null}
            {hasQuiz && quizRow ? (
              <ContentRow
                label="Quiz"
                subtitle={quizRow.subtitle}
                actionLabel={quizRow.actionLabel}
                href={`/dashboard/practice/quiz/${quizId}`}
              />
            ) : null}
            {hasFlashcards && flashcardsRow ? (
              <ContentRow
                label="Flashcards"
                subtitle={flashcardsRow.subtitle}
                actionLabel={flashcardsRow.actionLabel}
                href={flashcardsRow.href}
              />
            ) : null}
            <ContentRow
              label="Feedback"
              subtitle="Share how this lesson went for you"
              actionLabel="Give feedback"
              href={`/dashboard/feedback/${lesson.id}`}
            />
            <ContentRow
              label="My feedback"
              subtitle="View feedback you submitted for this lesson"
              actionLabel="View"
              href={`/dashboard/feedback/${lesson.id}/history`}
            />
          </div>

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

          {contentUnlocked && hasLegacyAudioSection && (
            <div className="mt-4 border-t border-zinc-100 pt-4">
              <p className="mb-1.5 text-sm text-zinc-500">Audio</p>
              <LessonInlineAudioRow
                lessonId={lesson.id}
                audioUrl={lesson.audio_url!}
                initialLastPosition={progress?.lastPosition ?? 0}
                initialCompleted={progress?.audioCompleted ?? false}
              />
            </div>
          )}
        </details>
      )}
    </div>
  );
}

function getQuizRowState(
  quizTitle: string | null,
  progress: QuizProgressRow | undefined,
  passed: boolean
): { subtitle: string; actionLabel: string } {
  const title = quizTitle?.trim() || "Quiz";

  if (!progress?.completed) {
    return { subtitle: `${title} — not started`, actionLabel: "Start" };
  }

  if (passed) {
    return { subtitle: `${title} — passed`, actionLabel: "Review" };
  }

  return { subtitle: `${title} — not passed`, actionLabel: "Retry" };
}

function getFlashcardsRowState(
  lessonId: string,
  flashcardSets: FlashcardSetInfo[],
  isSetComplete: (cardIds: string[]) => boolean
): { subtitle: string; actionLabel: string; href: string } {
  const allComplete = flashcardSets.every((set) => isSetComplete(set.cardIds));
  const targetSet =
    flashcardSets.find((set) => !isSetComplete(set.cardIds)) ?? flashcardSets[0];

  const subtitle = flashcardSets
    .map((set) => {
      const reviewed = isSetComplete(set.cardIds);
      return `${set.name} (${set.cardCount})${reviewed ? " · reviewed" : ""}`;
    })
    .join(" · ");

  return {
    subtitle,
    actionLabel: allComplete ? "Review" : "Start",
    href: deckPracticeHref(lessonId, targetSet.deckId),
  };
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
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-violet-600 shadow-sm transition-colors group-hover:border-violet-200"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-5 w-5 transition-transform duration-200 group-open:rotate-180"
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

function LessonCardHeader({
  lesson,
  unitLabel,
  completion,
  locked = false,
  muted = false,
  chevron = false,
  ariaLabel,
  scheduleSession,
}: {
  lesson: LessonWithCourse;
  unitLabel: string;
  completion?: LessonCompletionStatus;
  locked?: boolean;
  muted?: boolean;
  chevron?: boolean;
  ariaLabel?: string;
  scheduleSession?: StudentScheduledSession | null;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3" aria-label={ariaLabel}>
      {locked ? <LockIcon className="text-zinc-400" /> : null}
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
        <div className="min-w-0 flex-1 py-1">
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
          {scheduleSession ? (
            <p className="mt-2 text-sm font-medium text-violet-700">
              Upcoming live lesson: {formatSessionWhen(scheduleSession.starts_at, scheduleSession.ends_at)}
            </p>
          ) : null}
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
        {!locked && chevron ? <ChevronToggleIcon /> : null}
      </div>
    </div>
  );
}

function LessonScheduleBlock({
  scheduleSession,
}: {
  scheduleSession?: StudentScheduledSession | null;
}) {
  if (!scheduleSession) return null;

  const isGroup = Boolean(scheduleSession.cohort_id);

  return (
    <div className="mt-4 rounded-2xl bg-violet-50/70 px-4 py-3 text-sm">
      <p className="font-medium text-zinc-900">
        Upcoming live lesson: {formatSessionWhen(scheduleSession.starts_at, scheduleSession.ends_at)}
      </p>
      <p className="mt-1 text-zinc-600">
        {isGroup
          ? `${scheduleSession.cohortName ?? "Group session"} with ${scheduleSession.tutorName}`
          : `1-to-1 with ${scheduleSession.tutorName}`}
      </p>

      {scheduleSession.rescheduleRequest?.status === "pending" ? (
        <p className="mt-3 text-violet-900">Reschedule request pending.</p>
      ) : null}

      {scheduleSession.cohortSwitchRequest?.status === "pending" ? (
        <p className="mt-3 text-violet-900">Alternate cohort request pending.</p>
      ) : null}

      {scheduleSession.canRequestReschedule ? (
        <div className="mt-3">
          <p className="text-xs text-zinc-500">
            Need a different time? Ask now and your tutor can move this lesson to a free slot.
          </p>
          <RescheduleRequestForm sessionId={scheduleSession.id} />
        </div>
      ) : !isGroup &&
        scheduleSession.rescheduleLockedReason &&
        !scheduleSession.rescheduleRequest ? (
        <div className="mt-3">
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
      ) : null}

      {scheduleSession.canRequestCohortSwitch ? (
        <div className="mt-3">
          <p className="text-xs text-zinc-500">
            Can&apos;t make this group? Request a matching alternate cohort session here.
          </p>
          <CohortSwitchRequestForm session={scheduleSession} />
        </div>
      ) : isGroup &&
        scheduleSession.cohortSwitchLockedReason &&
        !scheduleSession.cohortSwitchRequest ? (
        <div className="mt-3">
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
      ) : null}
    </div>
  );
}

function ContentRow({
  label,
  subtitle,
  actionLabel,
  href,
  disabled = false,
  external = false,
}: {
  label: string;
  subtitle?: string;
  actionLabel: string;
  href?: string;
  disabled?: boolean;
  external?: boolean;
}) {
  const buttonClass = cn(
    lessonContentRowButtonClass,
    disabled && "cursor-not-allowed opacity-50 hover:bg-white"
  );

  const action =
    href && !disabled ? (
      external ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={buttonClass}>
          {actionLabel}
        </a>
      ) : (
        <NavLink href={href} className={buttonClass}>
          {actionLabel}
        </NavLink>
      )
    ) : (
      <button type="button" className={buttonClass} disabled={disabled}>
        {actionLabel}
      </button>
    );

  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-100 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-900">{label}</p>
        {subtitle ? <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
