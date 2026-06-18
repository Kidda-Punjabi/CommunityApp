import { LearnCourseCard } from "@/components/learn-course-card";
import {
  fetchLearnContent,
  filterFreeLessons,
} from "@/lib/learning/load-learn-content";
import {
  isLearnTrackUnlocked,
  lessonCountForTrack,
} from "@/lib/learning/learn-access";
import { LEARN_TRACKS } from "@/lib/learning/learn-catalog";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import { syncStripePurchasesForUser } from "@/lib/stripe/sync-purchases";
import { createClient } from "@/lib/supabase/server";

export default async function LearnPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email) {
    try {
      await syncStripePurchasesForUser(user.id, user.email);
    } catch {
      // Best-effort Stripe sync before loading lesson access.
    }
  }

  const access = await getCourseAccessContext(supabase, user!);
  const allLessons = await fetchLearnContent(supabase);

  const tracks = LEARN_TRACKS.map((track) => {
    if (track.alwaysUnlocked) {
      return {
        track,
        locked: false,
        lessonCount: filterFreeLessons(allLessons).length,
      };
    }

    return {
      track,
      locked: !isLearnTrackUnlocked(track, access),
      lessonCount: track.tier
        ? lessonCountForTrack(allLessons, access.courses, track.tier)
        : 0,
    };
  });

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Learn</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Choose a course to start learning.
        </p>
      </div>

      <div className="space-y-3">
        {tracks.map(({ track, locked, lessonCount }) => (
          <LearnCourseCard
            key={track.id}
            track={track}
            locked={locked}
            lessonCount={lessonCount}
          />
        ))}
      </div>
    </div>
  );
}
