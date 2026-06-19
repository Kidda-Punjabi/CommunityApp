import { LearnCourseCard } from "@/components/learn-course-card";
import {
  fetchLearnContent,
  filterFreeLessons,
} from "@/lib/learning/load-learn-content";
import {
  canAccessLessonInContext,
  filterLessonsForTrack,
  isLearnTrackUnlocked,
  lessonCountForTrack,
} from "@/lib/learning/learn-access";
import { LEARN_TRACKS } from "@/lib/learning/learn-catalog";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import { ui } from "@/lib/ui/styles";
import {
  fetchLessonCompletionMap,
  summarizeCourseProgress,
} from "@/lib/progress/lesson-completion";
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
  const completionMap = await fetchLessonCompletionMap(supabase, user!.id, allLessons);

  const tracks = LEARN_TRACKS.map((track) => {
    if (track.alwaysUnlocked) {
      const trackLessons = filterFreeLessons(allLessons);
      const accessibleLessons = trackLessons.filter((lesson) =>
        canAccessLessonInContext(access, lesson)
      );
      const progress = summarizeCourseProgress(accessibleLessons, completionMap);

      return {
        track,
        locked: false,
        lessonCount: trackLessons.length,
        courseProgress: {
          completed: progress.completedLessons,
          total: progress.totalLessons,
        },
      };
    }

    const locked = !isLearnTrackUnlocked(track, access);
    const trackLessons = track.tier
      ? filterLessonsForTrack(allLessons, access.courses, track.tier)
      : [];

    const accessibleLessons = locked
      ? []
      : trackLessons.filter((lesson) => canAccessLessonInContext(access, lesson));

    return {
      track,
      locked,
      lessonCount: track.tier
        ? lessonCountForTrack(allLessons, access.courses, track.tier)
        : 0,
      courseProgress: locked
        ? undefined
        : (() => {
            const progress = summarizeCourseProgress(accessibleLessons, completionMap);
            return {
              completed: progress.completedLessons,
              total: progress.totalLessons,
            };
          })(),
    };
  });

  return (
    <div className={ui.page}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Learn</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Choose a course to start learning.
        </p>
      </div>

      <div className={ui.stack}>
        {tracks.map(({ track, locked, lessonCount, courseProgress }) => (
          <LearnCourseCard
            key={track.id}
            track={track}
            locked={locked}
            lessonCount={lessonCount}
            courseProgress={
              courseProgress
                ? {
                    completed: courseProgress.completed,
                    total: courseProgress.total,
                  }
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
