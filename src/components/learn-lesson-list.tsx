import { LessonCard, LessonStatusDot, type LessonVisualStatus } from "@/components/lesson-card";
import { CourseProgressBar } from "@/components/course-progress-bar";
import {
  canAccessLessonInContext,
  isLessonContentUnlockedForUser,
} from "@/lib/learning/learn-access";
import { getCourseAccessContext, tierLabelForCourse } from "@/lib/membership/unlocked";
import type { LessonCompletionStatus } from "@/lib/progress/lesson-completion";
import { fetchLessonProgressMap } from "@/lib/progress/lesson-progress";
import { fetchFlashcardProgressMap } from "@/lib/progress/flashcard-progress";
import type { LessonRecordingView } from "@/lib/tutoring/lesson-content-access";
import type { HomeworkSubmissionView } from "@/lib/tutoring/homework-submissions";
import type { QuizProgressRow } from "@/lib/progress/quiz-progress";
import type { LessonWithCourse } from "@/app/dashboard/learn/types";
import type { StudentScheduledSession } from "@/lib/calendar/types";
import { BackLink } from "@/components/navigation/back-link";
import { ui } from "@/lib/ui/styles";
import type { ReactNode } from "react";

type LearnLessonListProps = {
  title: string;
  subtitle: string;
  lessons: LessonWithCourse[];
  access: Awaited<ReturnType<typeof getCourseAccessContext>>;
  progressMap: Awaited<ReturnType<typeof fetchLessonProgressMap>>;
  flashcardProgressMap: Awaited<ReturnType<typeof fetchFlashcardProgressMap>>;
  quizProgressMap?: Map<string, QuizProgressRow>;
  completionMap: Map<string, LessonCompletionStatus>;
  courseProgress?: {
    completed: number;
    total: number;
  };
  backHref?: string;
  staffSection?: ReactNode;
  footerSection?: ReactNode;
  contentUnlockedMap?: Map<string, boolean>;
  /**
   * When true, lesson content follows `contentUnlockedMap` only (missing = locked).
   * Needed for kids group courses: private `course_access` must not unlock every lesson.
   */
  honorContentUnlockMap?: boolean;
  recordingMap?: Map<string, LessonRecordingView>;
  homeworkMap?: Map<string, HomeworkSubmissionView>;
  /** lesson_id → cohort_lesson_homework.completed */
  cohortHomeworkCompletedMap?: Map<string, boolean>;
  showHomework?: boolean;
  unitLabel?: string;
  catchupLessonIds?: Set<string>;
  feedbackSubmittedLessonIds?: Set<string>;
  homeworkFocusLessonId?: string | null;
  catchupReturn?: string | null;
  /** When false, hides the course-level “X of Y lessons complete” bar (Community). */
  showCourseProgress?: boolean;
  /** Tighten space between Back and the title (Foundational Course). */
  compactHeader?: boolean;
  /** Do not auto-open a week accordion on load (Foundational Course). */
  collapseLessonsByDefault?: boolean;
  /** Where to render the in-progress / next-up / locked key. */
  statusLegendPosition?: "top" | "bottom";
  scheduleSessionByLessonId?: Map<string, StudentScheduledSession>;
};

export function LearnLessonList({
  title,
  subtitle,
  lessons,
  access,
  progressMap,
  flashcardProgressMap,
  quizProgressMap,
  completionMap,
  courseProgress,
  backHref = "/dashboard/learn",
  staffSection,
  footerSection,
  contentUnlockedMap,
  honorContentUnlockMap = false,
  recordingMap,
  homeworkMap,
  cohortHomeworkCompletedMap,
  showHomework = false,
  unitLabel,
  catchupLessonIds,
  feedbackSubmittedLessonIds,
  homeworkFocusLessonId,
  catchupReturn,
  showCourseProgress = true,
  compactHeader = false,
  collapseLessonsByDefault = false,
  statusLegendPosition = "top",
  scheduleSessionByLessonId,
}: LearnLessonListProps) {
  const unlockedMap = contentUnlockedMap ?? new Map<string, boolean>();

  function lessonAccess(lesson: LessonWithCourse) {
    const canBrowse = canAccessLessonInContext(access, lesson);
    if (honorContentUnlockMap) {
      return {
        canBrowse,
        contentUnlocked:
          canBrowse && (lesson.is_free || unlockedMap.get(lesson.id) === true),
      };
    }
    const contentUnlocked = isLessonContentUnlockedForUser(
      access,
      lesson,
      unlockedMap.get(lesson.id)
    );
    return { canBrowse, contentUnlocked };
  }

  const defaultExpandedLessonId =
    homeworkFocusLessonId ??
    lessons.find((lesson) => {
      const { canBrowse, contentUnlocked } = lessonAccess(lesson);
      const completion = completionMap.get(lesson.id);
      if (!(canBrowse && contentUnlocked && completion && !completion.fullyComplete)) {
        return false;
      }
      const session = scheduleSessionByLessonId?.get(lesson.id);
      // Prefer an incomplete lesson that is still upcoming (or has no calendar session).
      if (!session) return true;
      return new Date(session.ends_at).getTime() >= Date.now();
    })?.id ??
    lessons.find((lesson) => {
      const session = scheduleSessionByLessonId?.get(lesson.id);
      if (!session) return false;
      return new Date(session.ends_at).getTime() >= Date.now();
    })?.id ??
    lessons.find((lesson) => {
      const { canBrowse, contentUnlocked } = lessonAccess(lesson);
      const completion = completionMap.get(lesson.id);
      return canBrowse && contentUnlocked && completion && !completion.fullyComplete;
    })?.id ??
    lessons.find((lesson) => {
      const { canBrowse, contentUnlocked } = lessonAccess(lesson);
      return canBrowse && contentUnlocked;
    })?.id;

  const nextUpLessonId = (() => {
    const now = Date.now();
    const scheduled = lessons
      .filter((lesson) => {
        if (lesson.id === defaultExpandedLessonId) return false;
        const session = scheduleSessionByLessonId?.get(lesson.id);
        if (!session) return false;
        return new Date(session.ends_at).getTime() >= now;
      })
      .sort((a, b) => {
        const aSession = scheduleSessionByLessonId!.get(a.id)!;
        const bSession = scheduleSessionByLessonId!.get(b.id)!;
        const aStarts =
          aSession.cohortSwitchRequest?.status === "approved" &&
          aSession.cohortSwitchRequest.toSessionStartsAt
            ? aSession.cohortSwitchRequest.toSessionStartsAt
            : aSession.starts_at;
        const bStarts =
          bSession.cohortSwitchRequest?.status === "approved" &&
          bSession.cohortSwitchRequest.toSessionStartsAt
            ? bSession.cohortSwitchRequest.toSessionStartsAt
            : bSession.starts_at;
        return new Date(aStarts).getTime() - new Date(bStarts).getTime();
      });
    if (scheduled[0]) return scheduled[0].id;

    return lessons.find((lesson) => {
      if (lesson.id === defaultExpandedLessonId) return false;
      const { canBrowse, contentUnlocked } = lessonAccess(lesson);
      return canBrowse && !contentUnlocked;
    })?.id;
  })();

  function visualStatusFor(lesson: LessonWithCourse): LessonVisualStatus {
    const session = scheduleSessionByLessonId?.get(lesson.id);
    const sessionPast = session ? new Date(session.ends_at).getTime() < Date.now() : false;

    // Past live sessions shouldn't stay "In progress" — they're done on the calendar.
    if (lesson.id === defaultExpandedLessonId && !sessionPast) return "in_progress";
    if (lesson.id === nextUpLessonId) return "next_up";
    const { canBrowse, contentUnlocked } = lessonAccess(lesson);
    if (canBrowse && !contentUnlocked) return "locked";
    if (
      session?.cohortSwitchRequest?.status === "approved" ||
      session?.rescheduleRequest?.status === "approved"
    ) {
      return "rescheduled";
    }
    return "available";
  }

  const accessibleLessons = lessons.filter((lesson) => {
    const { canBrowse, contentUnlocked } = lessonAccess(lesson);
    return canBrowse && contentUnlocked;
  });

  const hasTutorLockedLessons = lessons.some((lesson) => {
    const { canBrowse, contentUnlocked } = lessonAccess(lesson);
    return canBrowse && !contentUnlocked;
  });

  const progressSummary = {
    completed:
      courseProgress?.completed ??
      lessons.filter((lesson) => completionMap.get(lesson.id)?.fullyComplete).length,
    total: lessons.length,
  };

  return (
    <div className={ui.page}>
      <BackLink fallbackHref={backHref}>← Back</BackLink>

      <div className={compactHeader ? "mb-5 mt-2" : "mb-8 mt-4"}>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{title}</h1>
        {subtitle.trim() ? (
          <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
        ) : null}
        {showCourseProgress && accessibleLessons.length > 0 && (
          <CourseProgressBar
            className="mt-4"
            completed={progressSummary.completed}
            total={progressSummary.total}
          />
        )}
      </div>

      {staffSection}

      {lessons.length === 0 ? (
        <div className={ui.emptyState}>
          <span className="text-5xl" role="img" aria-hidden="true">
            📚
          </span>
          <p className="mt-4 text-lg font-semibold text-zinc-900">No lessons yet</p>
          <p className="mt-2 text-sm text-zinc-500">
            Lessons will appear here when added in admin.
          </p>
        </div>
      ) : (
        <div className={ui.stack}>
          {statusLegendPosition === "top" ? <LessonStatusLegend /> : null}
          {lessons.map((lesson) => {
            const row = progressMap.get(lesson.id);
            const { canBrowse, contentUnlocked } = lessonAccess(lesson);

            return (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                accordionName="learn-lessons"
                defaultExpanded={
                  collapseLessonsByDefault
                    ? false
                    : lesson.id === defaultExpandedLessonId
                }
                canBrowse={canBrowse}
                contentUnlocked={contentUnlocked}
                visualStatus={visualStatusFor(lesson)}
                requiredCourseLabel={tierLabelForCourse(access.courses, lesson.course_id)}
                progress={
                  row
                    ? {
                        audioCompleted: row.completed,
                        lastPosition: row.last_position,
                        pdfCompleted: row.pdf_completed,
                        lastPageViewed: row.last_page_viewed,
                      }
                    : undefined
                }
                completion={contentUnlocked ? completionMap.get(lesson.id) : undefined}
                flashcardProgressMap={flashcardProgressMap}
                quizProgressMap={quizProgressMap}
                recording={recordingMap?.get(lesson.id) ?? null}
                homework={homeworkMap?.get(lesson.id) ?? null}
                homeworkCompleted={cohortHomeworkCompletedMap?.get(lesson.id) === true}
                showHomework={showHomework}
                unitLabel={unitLabel}
                hasCatchupSegments={catchupLessonIds?.has(lesson.id) ?? false}
                hasSubmittedFeedback={feedbackSubmittedLessonIds?.has(lesson.id) ?? false}
                homeworkCatchupReturn={
                  homeworkFocusLessonId === lesson.id ? (catchupReturn ?? null) : null
                }
                scheduleSession={scheduleSessionByLessonId?.get(lesson.id) ?? null}
              />
            );
          })}
          {hasTutorLockedLessons ? (
            <p className="pt-2 text-sm text-zinc-500">
              If a lesson is greyed out or shows a lock, your tutor will unlock it once you have
              completed that session.
            </p>
          ) : null}
          {statusLegendPosition === "bottom" ? (
            <div className="pt-2">
              <LessonStatusLegend />
            </div>
          ) : null}
        </div>
      )}

      {footerSection ? <div className="mt-8">{footerSection}</div> : null}
    </div>
  );
}

function LessonStatusLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-500">
      <li className="inline-flex items-center gap-1.5">
        <LessonStatusDot status="in_progress" />
        In progress
      </li>
      <li className="inline-flex items-center gap-1.5">
        <LessonStatusDot status="next_up" />
        Next up
      </li>
      <li className="inline-flex items-center gap-1.5">
        <LessonStatusDot status="rescheduled" />
        Rescheduled
      </li>
      <li className="inline-flex items-center gap-1.5">
        <LessonStatusDot status="locked" />
        Locked
      </li>
    </ul>
  );
}
