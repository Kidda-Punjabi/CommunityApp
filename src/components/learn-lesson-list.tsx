import { LessonCard } from "@/components/lesson-card";
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
import Link from "next/link";
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
  recordingMap?: Map<string, LessonRecordingView>;
  homeworkMap?: Map<string, HomeworkSubmissionView>;
  showHomework?: boolean;
  unitLabel?: string;
  catchupLessonIds?: Set<string>;
  homeworkFocusLessonId?: string | null;
  catchupReturn?: string | null;
  /** When false, hides the course-level “X of Y lessons complete” bar (Community). */
  showCourseProgress?: boolean;
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
  recordingMap,
  homeworkMap,
  showHomework = false,
  unitLabel,
  catchupLessonIds,
  homeworkFocusLessonId,
  catchupReturn,
  showCourseProgress = true,
  scheduleSessionByLessonId,
}: LearnLessonListProps) {
  const unlockedMap = contentUnlockedMap ?? new Map<string, boolean>();
  const defaultExpandedLessonId =
    homeworkFocusLessonId ??
    lessons.find((lesson) => {
      const canBrowse = canAccessLessonInContext(access, lesson);
      const contentUnlocked = isLessonContentUnlockedForUser(
        access,
        lesson,
        unlockedMap.get(lesson.id)
      );
      const completion = completionMap.get(lesson.id);
      return canBrowse && contentUnlocked && completion && !completion.fullyComplete;
    })?.id ??
    lessons.find((lesson) => {
      const canBrowse = canAccessLessonInContext(access, lesson);
      const contentUnlocked = isLessonContentUnlockedForUser(
        access,
        lesson,
        unlockedMap.get(lesson.id)
      );
      return canBrowse && contentUnlocked;
    })?.id;

  const accessibleLessons = lessons.filter((lesson) => {
    const canBrowse = canAccessLessonInContext(access, lesson);
    const contentUnlocked = isLessonContentUnlockedForUser(
      access,
      lesson,
      unlockedMap.get(lesson.id)
    );
    return canBrowse && contentUnlocked;
  });

  const hasTutorLockedLessons = lessons.some((lesson) => {
    const canBrowse = canAccessLessonInContext(access, lesson);
    const contentUnlocked = isLessonContentUnlockedForUser(
      access,
      lesson,
      unlockedMap.get(lesson.id)
    );
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

      <div className="mb-8 mt-4">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
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
          {lessons.map((lesson) => {
            const row = progressMap.get(lesson.id);
            const canBrowse = canAccessLessonInContext(access, lesson);
            const contentUnlocked = isLessonContentUnlockedForUser(
              access,
              lesson,
              unlockedMap.get(lesson.id)
            );

            return (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                accordionName="learn-lessons"
                defaultExpanded={lesson.id === defaultExpandedLessonId}
                canBrowse={canBrowse}
                contentUnlocked={contentUnlocked}
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
                showHomework={showHomework}
                unitLabel={unitLabel}
                hasCatchupSegments={catchupLessonIds?.has(lesson.id) ?? false}
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
        </div>
      )}

      {footerSection ? <div className="mt-8">{footerSection}</div> : null}
    </div>
  );
}
