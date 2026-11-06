import Link from "next/link";
import { LessonInlineAudioRow } from "@/components/lesson-inline-audio-row";
import type { LessonWithCourse } from "@/app/dashboard/learn/types";
import {
  CollapsedActivityStatus,
  formatLessonCardTitle,
  getQuizTileState,
  getScheduleDisplay,
  LessonScheduleBlock,
  LessonScheduleRequestSection,
  lessonContentRowButtonClass,
  LockIcon,
} from "@/components/lesson-card";
import { LessonPdfViewer } from "@/components/lesson-pdf-viewer";
import { LessonSheet } from "@/components/lesson/lesson-sheet";
import { LessonWeekTiles } from "@/components/lesson/lesson-week-tiles";
import { SHOW_LESSON_AUDIO, SHOW_LESSON_PDF } from "@/lib/learning/lesson-content-flags";
import type { LessonRecordingView } from "@/lib/tutoring/lesson-content-access";
import type { HomeworkSubmissionView } from "@/lib/tutoring/homework-submissions";
import type { LessonCompletionStatus } from "@/lib/progress/lesson-completion";
import type { QuizProgressRow } from "@/lib/progress/quiz-progress";
import type { StudentScheduledSession } from "@/lib/calendar/types";
import { lessonHomeworkPath } from "@/lib/tutoring/homework-href";
import { cn, ui } from "@/lib/ui/styles";
import type { ReactNode } from "react";

export type LessonRailState = "done" | "current" | "upcoming";

const RAIL_NODE: Record<LessonRailState, string> = {
  done: "h-[38px] w-[38px] bg-violet-600 text-white",
  current: "h-[46px] w-[46px] bg-amber-300 text-zinc-900",
  upcoming: "h-[38px] w-[38px] bg-zinc-200 text-zinc-600",
};

/** One stop on the course line: a numbered circle, joined to the stops either side. */
function LessonRailStop({
  state,
  weekNumber,
  isFirst,
  isLast,
  children,
}: {
  state: LessonRailState;
  weekNumber: number;
  isFirst: boolean;
  isLast: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative flex items-center gap-3">
      {isLast ? null : (
        <span
          aria-hidden="true"
          className={cn("absolute left-[21px] w-1", isFirst ? "top-1/2" : "top-0", "-bottom-6", state === "done" ? "bg-violet-600" : "bg-violet-100")}
        />
      )}
      {!isFirst && isLast ? (
        <span aria-hidden="true" className={cn("absolute left-[21px] top-0 h-1/2 w-1", state === "done" ? "bg-violet-600" : "bg-violet-100")} />
      ) : null}
      <span className="relative flex w-[46px] shrink-0 justify-center">
        <span
          aria-label={`Week ${weekNumber}`}
          className={cn("flex items-center justify-center rounded-full border-[3px] border-zinc-50 text-sm font-extrabold tabular-nums", RAIL_NODE[state])}
        >
          {weekNumber}
        </span>
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

type LessonProgress = {
  audioCompleted: boolean;
  lastPosition: number;
  pdfCompleted: boolean;
  lastPageViewed: number;
};

type LessonLineCardProps = {
  lesson: LessonWithCourse;
  defaultExpanded?: boolean;
  canBrowse: boolean;
  contentUnlocked: boolean;
  requiredCourseLabel?: string;
  progress?: LessonProgress;
  completion?: LessonCompletionStatus;
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
  nativeApp?: boolean;
  railState?: LessonRailState;
  isFirst?: boolean;
  isLast?: boolean;
};

export function LessonLineCard({
  lesson,
  defaultExpanded = false,
  canBrowse,
  contentUnlocked,
  requiredCourseLabel,
  progress,
  completion,
  quizProgressMap,
  recording,
  homework,
  homeworkCompleted = false,
  showHomework = false,
  hasCatchupSegments = false,
  hasSubmittedFeedback = false,
  homeworkCatchupReturn = null,
  scheduleSession = null,
  nativeApp = false,
  railState = "upcoming",
  isFirst = false,
  isLast = false,
}: LessonLineCardProps) {
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

  const quizProgress = quizId ? quizProgressMap?.get(quizId) : undefined;
  const quizTile = hasQuiz
    ? getQuizTileState(quizProgress, Boolean(completion?.quizComplete))
    : null;

  const hasLessonContent =
    hasPresentation ||
    hasPdf ||
    hasApprovedGeneratedAudio ||
    hasLegacyAudioSection ||
    Boolean(recording) ||
    hasFlashcards ||
    Boolean(quizId);

  const isTutorLocked = canBrowse && !contentUnlocked;
  const scheduleDisplay = getScheduleDisplay(scheduleSession);
  const lessonTitle = formatLessonCardTitle(lesson.title);
  const isCurrent = railState === "current";

  if (!canBrowse) {
    return (
      <div id={`lesson-${lesson.id}`} className="scroll-mt-6">
        <LessonRailStop state="upcoming" weekNumber={lesson.lesson_number} isFirst={isFirst} isLast={isLast}>
          <div className="flex items-center gap-3 rounded-[18px] border border-zinc-200 bg-white px-3.5 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold text-zinc-600">{lessonTitle}</p>
              <p className="mt-0.5 text-xs font-medium text-zinc-600">
                {nativeApp
                  ? "This course isn't on your account."
                  : `Unlock with ${requiredCourseLabel ?? "this course"}.`}
              </p>
            </div>
            {nativeApp ? (
              <span aria-hidden="true">🔒</span>
            ) : (
              <Link href="/dashboard/membership" className={lessonContentRowButtonClass}>
                View plans
              </Link>
            )}
          </div>
        </LessonRailStop>
      </div>
    );
  }

  return (
    <div id={`lesson-${lesson.id}`} className="scroll-mt-6">
      <LessonRailStop state={railState} weekNumber={lesson.lesson_number} isFirst={isFirst} isLast={isLast}>
        <LessonSheet
          lessonId={lesson.id}
          weekNumber={lesson.lesson_number}
          title={lessonTitle}
          defaultOpen={defaultExpanded}
          trigger={
            <span
              className={cn(
                "flex items-center gap-2 rounded-[18px] border transition-colors",
                isCurrent
                  ? "border-[#5B21B6] bg-[#5B21B6] px-4 py-4 text-white"
                  : "border-zinc-200 bg-white px-3.5 py-2.5 text-zinc-900 hover:border-violet-200",
                isTutorLocked && !isCurrent && "bg-zinc-50"
              )}
            >
              <span className="min-w-0 flex-1">
                <span className={cn("block font-extrabold leading-snug", isCurrent ? "text-xl" : "text-[15px]")}>{lessonTitle}</span>
                {scheduleDisplay ? (
                  <span
                    className={cn(
                      "mt-0.5 block text-[13px] font-semibold",
                      isCurrent ? "text-white" : scheduleDisplay.isRescheduled ? "text-teal-700" : "text-zinc-600"
                    )}
                  >
                    {formatRowWhen(scheduleDisplay.startsAt)}
                  </span>
                ) : null}
              </span>
              {isTutorLocked ? (
                <LockIcon className={isCurrent ? "text-white" : "text-zinc-500"} />
              ) : (
                <CollapsedActivityStatus
                  showHomework={showHomework}
                  homeworkDone={homeworkCompleted}
                  showQuiz={hasQuiz}
                  quizDone={Boolean(completion?.quizComplete)}
                  onDark={isCurrent}
                  large
                />
              )}
            </span>
          }
        >
        <div className="mt-1">
          <LessonScheduleBlock scheduleSession={scheduleSession} plain />

          {isTutorLocked ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-zinc-500">
                Content unlocks after your tutor opens this lesson.
              </p>
              {showHomework ? (
                <Link href={lessonHomeworkPath(lesson.id, homeworkCatchupReturn)} className={ui.btnSecondary}>
                  Record homework
                </Link>
              ) : null}
            </div>
          ) : (
            <>
              <LessonWeekTiles
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
                practiceHref={`/dashboard/learn/beginners/week/${lesson.lesson_number}`}
                hasSubmittedFeedback={hasSubmittedFeedback}
                startingPointHref={
                  contentUnlocked &&
                  lesson.lesson_number === 1 &&
                  lesson.courses?.name === "Beginners Course"
                    ? `/dashboard/feedback/${lesson.id}/starting-point`
                    : null
                }
                sessionCatchupHref={hasCatchupSegments ? `/catchup/${lesson.id}` : null}
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
        </LessonSheet>
      </LessonRailStop>
    </div>
  );
}

function formatRowWhen(startsAtIso: string): string {
  const start = new Date(startsAtIso);
  const date = start.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/London",
  });
  const time = start.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Europe/London",
  });
  return `${date}, ${time}`;
}
