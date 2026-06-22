import { LessonCard } from "@/components/lesson-card";
import { CourseProgressBar } from "@/components/course-progress-bar";
import { canAccessLessonInContext } from "@/lib/learning/learn-access";
import { getCourseAccessContext, tierLabelForCourse } from "@/lib/membership/unlocked";
import type { LessonCompletionStatus } from "@/lib/progress/lesson-completion";
import { fetchLessonProgressMap } from "@/lib/progress/lesson-progress";
import { fetchFlashcardProgressMap } from "@/lib/progress/flashcard-progress";
import type { LessonRecordingView } from "@/lib/tutoring/lesson-content-access";
import type { LessonWithCourse } from "@/app/dashboard/learn/types";
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
  completionMap: Map<string, LessonCompletionStatus>;
  courseProgress?: {
    completed: number;
    total: number;
  };
  backHref?: string;
  staffSection?: ReactNode;
  contentUnlockedMap?: Map<string, boolean>;
  recordingMap?: Map<string, LessonRecordingView>;
};

export function LearnLessonList({
  title,
  subtitle,
  lessons,
  access,
  progressMap,
  flashcardProgressMap,
  completionMap,
  courseProgress,
  backHref = "/dashboard/learn",
  staffSection,
  contentUnlockedMap,
  recordingMap,
}: LearnLessonListProps) {
  const unlockedMap = contentUnlockedMap ?? new Map<string, boolean>();

  const accessibleLessons = lessons.filter((lesson) => {
    const canBrowse = canAccessLessonInContext(access, lesson);
    const contentUnlocked = unlockedMap.get(lesson.id) ?? lesson.is_free;
    return canBrowse && contentUnlocked;
  });

  const progressSummary = courseProgress ?? {
    completed: accessibleLessons.filter(
      (lesson) => completionMap.get(lesson.id)?.fullyComplete
    ).length,
    total: accessibleLessons.length,
  };

  return (
    <div className={ui.page}>
      <Link
        href={backHref}
        className="text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← Back to Learn
      </Link>

      <div className="mb-8 mt-4">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
        {accessibleLessons.length > 0 && (
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
            const contentUnlocked = unlockedMap.get(lesson.id) ?? lesson.is_free;

            return (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
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
                recording={recordingMap?.get(lesson.id) ?? null}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
