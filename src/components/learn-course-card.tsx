import Link from "next/link";
import type { LearnTrack } from "@/lib/learning/learn-catalog";
import { learnTrackPath } from "@/lib/learning/learn-catalog";

type LearnCourseCardProps = {
  track: LearnTrack;
  locked: boolean;
  lessonCount?: number;
};

export function LearnCourseCard({ track, locked, lessonCount }: LearnCourseCardProps) {
  const showLock = !track.alwaysUnlocked && locked;

  return (
    <Link
      href={learnTrackPath(track.id)}
      className={`block rounded-2xl border bg-white p-5 shadow-sm transition-colors ${
        showLock
          ? "border-zinc-200 hover:border-zinc-300"
          : "border-violet-200 hover:border-violet-300 hover:bg-violet-50/30"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            {track.alwaysUnlocked ? "Open to everyone" : "Course"}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-900">{track.title}</h2>
          <p className="mt-2 text-sm text-zinc-500">{track.description}</p>
          {lessonCount !== undefined && lessonCount > 0 && (
            <p className="mt-2 text-xs font-medium text-zinc-400">
              {lessonCount} lesson{lessonCount === 1 ? "" : "s"}
            </p>
          )}
        </div>
        {showLock ? (
          <span className="shrink-0 text-xl" aria-label="Locked" title="Locked">
            🔒
          </span>
        ) : (
          <span className="shrink-0 text-sm font-semibold text-violet-600">→</span>
        )}
      </div>
    </Link>
  );
}
