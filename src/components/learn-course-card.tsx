import { NavLink } from "@/components/ui/nav-link";
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

export function LearnCourseCard({
  track,
  locked,
  lessonCount,
  courseProgress,
}: LearnCourseCardProps) {
  const showLock = !track.alwaysUnlocked && locked;
  const showProgress = !showLock && courseProgress && courseProgress.total > 0;
  const href = learnTrackPath(track.id);
  const salesHref = track.unlockUrl ?? `/courses/${track.id}`;

  const subtitle =
    showProgress || showLock
      ? track.description
      : lessonCount !== undefined && lessonCount > 0
        ? `${lessonCount} lesson${lessonCount === 1 ? "" : "s"}`
        : track.description;

  if (showLock) {
    return (
      <div className={`${ui.listRow} flex-col items-stretch gap-0 p-0`}>
        <div className="p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            Course
          </p>
          <p className="mt-0.5 font-heading font-semibold text-zinc-900">{track.title}</p>
          <p className="mt-0.5 truncate text-sm text-zinc-500">{subtitle}</p>
          <NavLink href={salesHref} className={`mt-2.5 inline-flex ${ui.btnSecondary}`}>
            Find out more
          </NavLink>
        </div>
      </div>
    );
  }

  return (
    <div className={`${ui.listRow} flex-col items-stretch gap-0 p-0`}>
      <NavLink href={href} className="group flex items-center gap-3 p-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            {track.alwaysUnlocked ? "Open to everyone" : "Course"}
          </p>
          <p className="mt-0.5 font-heading font-semibold text-zinc-900">{track.title}</p>
          <p className="mt-0.5 truncate text-sm text-zinc-500">{subtitle}</p>
          {showProgress && (
            <CourseProgressBar
              className="mt-2"
              completed={courseProgress.completed}
              total={courseProgress.total}
            />
          )}
        </div>
        <span className={ui.btnIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-4 w-4">
            <path d="M8 5.14v14.72a1 1 0 0 0 1.5.86l11.04-7.36a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z" />
          </svg>
        </span>
      </NavLink>
    </div>
  );
}
