import { LearnCourseCard } from "@/components/learn-course-card";
import { ResourceListSection } from "@/components/resources/resource-list-section";
import { fetchLearnContent } from "@/lib/learning/load-learn-content";
import {
  canAccessLessonInContext,
  filterLessonsForTrack,
  isLearnTrackUnlocked,
  lessonCountForTrack,
} from "@/lib/learning/learn-access";
import { resolveGroupCohortContentGate } from "@/lib/learning/group-cohort-content-gate";
import { LEARN_TRACKS, shouldShowLearnCourseProgress } from "@/lib/learning/learn-catalog";
import { findCoursesForTier } from "@/lib/membership/courses";
import {
  getCachedAuthSession,
  getCachedCourseAccess,
} from "@/lib/supabase/cached-session";
import { ui } from "@/lib/ui/styles";
import {
  fetchLessonCompletionMap,
  summarizeCourseProgress,
} from "@/lib/progress/lesson-completion";
import { syncStripePurchasesForUser } from "@/lib/stripe/sync-purchases";
import { redirect } from "next/navigation";

export default async function LearnPage() {
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  const { supabase, user } = session;

  if (user.email) {
    void syncStripePurchasesForUser(user.id, user.email).catch(() => {
      // Best-effort Stripe sync — do not block tab render.
    });
  }

  const lessonsPromise = fetchLearnContent(supabase);
  const [access, allLessons, completionMap] = await Promise.all([
    getCachedCourseAccess(supabase, user),
    lessonsPromise,
    lessonsPromise.then((lessons) =>
      fetchLessonCompletionMap(supabase, user.id, lessons)
    ),
  ]);

  // Everyday Punjabi lives on Home — keep /learn/free routes, omit the Learn hub card.
  const learnHubTracks = LEARN_TRACKS.filter((track) => track.id !== "free");

  const tracks = await Promise.all(
    learnHubTracks.map(async (track) => {
      const locked = !isLearnTrackUnlocked(track, access);
      const trackLessons = track.tier
        ? filterLessonsForTrack(allLessons, access.courses, track.tier)
        : [];

      let opensOnMessage: string | null = null;
      if (!locked && track.tier) {
        const courseIds = findCoursesForTier(access.courses, track.tier).map((c) => c.id);
        const gate = await resolveGroupCohortContentGate(supabase, user.id, courseIds);
        if (gate?.gated) opensOnMessage = gate.message;
      }

      const accessibleLessons =
        locked || opensOnMessage
          ? []
          : trackLessons.filter((lesson) => canAccessLessonInContext(access, lesson));

      return {
        track,
        locked,
        opensOnMessage,
        lessonCount: track.tier
          ? lessonCountForTrack(allLessons, access.courses, track.tier)
          : 0,
        courseProgress:
          locked || opensOnMessage
            ? undefined
            : !shouldShowLearnCourseProgress(track.id)
              ? undefined
              : (() => {
                  const progress = summarizeCourseProgress(accessibleLessons, completionMap);
                  return {
                    completed: progress.completedLessons,
                    total: progress.totalLessons,
                  };
                })(),
      };
    })
  );

  return (
    <div className={ui.page}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Learn</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Browse courses, track your progress, and pick up reference tools when you need them.
        </p>
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        All courses
      </h2>

      <div className={ui.stack}>
        {tracks.map(({ track, locked, opensOnMessage, lessonCount, courseProgress }) => (
          <LearnCourseCard
            key={track.id}
            track={track}
            locked={locked}
            opensOnMessage={opensOnMessage}
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

      <div className="mt-10">
        <ResourceListSection />
      </div>
    </div>
  );
}
