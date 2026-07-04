import { BackLink } from "@/components/navigation/back-link";
import Link from "next/link";
import { BOOK_CALL_PATH } from "@/lib/booking/constants";
import type { LearnTrack } from "@/lib/learning/learn-catalog";

type LearnLockedCourseProps = {
  track: LearnTrack;
  lessonCount: number;
};

function isInternalUrl(url: string): boolean {
  return url.startsWith("/");
}

export function LearnLockedCourse({ track, lessonCount }: LearnLockedCourseProps) {
  const unlockHref = track.unlockUrl ?? `/courses/${track.id}`;

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <BackLink fallbackHref="/dashboard/learn" className="text-sm font-medium text-violet-600 hover:text-violet-500">← Back to Learn</BackLink>

      <div className="mt-8 flex flex-1 flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white px-6 py-12 text-center shadow-sm">
        <span className="text-5xl" role="img" aria-hidden="true">
          🔒
        </span>
        <h1 className="mt-4 text-2xl font-bold text-zinc-900">{track.title}</h1>
        <p className="mt-3 max-w-sm text-sm text-zinc-600">
          Unlock {track.lockProductName ?? track.title} to access all{" "}
          {lessonCount} lesson{lessonCount === 1 ? "" : "s"}.
        </p>
        {isInternalUrl(unlockHref) ? (
          <Link
            href={`${unlockHref}#pricing`}
            className="mt-6 inline-block rounded-lg bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500"
          >
            View course & buy
          </Link>
        ) : (
          <a
            href={unlockHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-block rounded-lg bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500"
          >
            View course & buy
          </a>
        )}
        <BackLink fallbackHref={BOOK_CALL_PATH} className="mt-3 text-sm font-medium text-violet-600 hover:text-violet-500">Book a call with our team</BackLink>
        <Link
          href="/dashboard/profile/billing"
          className="mt-2 text-sm font-medium text-zinc-500 hover:text-violet-600"
        >
          View billing & purchases
        </Link>
      </div>
    </div>
  );
}
