import Link from "next/link";
import type { LearnTrack } from "@/lib/learning/learn-catalog";
import { learnTrackPath } from "@/lib/learning/learn-catalog";
import { CourseProgressBar } from "@/components/course-progress-bar";
import { ui } from "@/lib/ui/styles";

type LearnCourseCardProps = {
  track: LearnTrack;
  locked: boolean;
  lessonCount?: number;
  courseProgress?: {
    completed: number;
    total: number;
  };
};

function BookIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      className="h-6 w-6 text-violet-600"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
      />
    </svg>
  );
}

export function LearnCourseCard({
  track,
  locked,
  lessonCount,
  courseProgress,
}: LearnCourseCardProps) {
  const showLock = !track.alwaysUnlocked && locked;
  const showProgress = !showLock && courseProgress && courseProgress.total > 0;

  const subtitle = showProgress
    ? track.description
    : lessonCount !== undefined && lessonCount > 0
      ? `${lessonCount} lesson${lessonCount === 1 ? "" : "s"}`
      : track.description;

  return (
    <Link
      href={learnTrackPath(track.id)}
      className={`group ${ui.listRow} ${showLock ? "opacity-90" : ""}`}
    >
      <span className={ui.listRowIcon}>
        {showLock ? <span className="text-xl">🔒</span> : <BookIcon />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
          {track.alwaysUnlocked ? "Open to everyone" : "Course"}
        </p>
        <p className="mt-0.5 font-heading font-semibold text-zinc-900">{track.title}</p>
        <p className="mt-0.5 line-clamp-2 text-sm text-zinc-500">{subtitle}</p>
        {showProgress && (
          <CourseProgressBar
            className="mt-3"
            completed={courseProgress.completed}
            total={courseProgress.total}
          />
        )}
      </div>
      {!showLock && (
        <span className={ui.btnIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-4 w-4">
            <path d="M8 5.14v14.72a1 1 0 0 0 1.5.86l11.04-7.36a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z" />
          </svg>
        </span>
      )}
    </Link>
  );
}
