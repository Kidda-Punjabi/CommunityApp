import { LearnCourseCard } from "@/components/learn-course-card";
import { ResourceListSection } from "@/components/resources/resource-list-section";
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
import { resolveGroupCohortContentGate } from "@/lib/learning/group-cohort-content-gate";
import { LEARN_TRACKS, shouldShowLearnCourseProgress } from "@/lib/learning/learn-catalog";
import { findCoursesForTier } from "@/lib/membership/courses";
import { loadStudentNextLiveLesson } from "@/lib/lessons/load-student-next-live-lesson";
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
  const [access, allLessons, completionMap, nextLiveLesson] = await Promise.all([
    getCachedCourseAccess(supabase, user),
    lessonsPromise,
    lessonsPromise.then((lessons) => fetchLessonCompletionMap(supabase, user.id, lessons)),
    loadStudentNextLiveLesson(supabase, user.id),
  ]);

  const tracks = await Promise.all(
    LEARN_TRACKS.map(async (track) => {
      if (track.alwaysUnlocked) {
        const trackLessons = filterFreeLessons(allLessons);
        const accessibleLessons = trackLessons.filter((lesson) =>
          canAccessLessonInContext(access, lesson)
        );
        const progress = summarizeCourseProgress(accessibleLessons, completionMap);

        return {
          track,
          locked: false,
          opensOnMessage: null as string | null,
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
        {nextLiveLesson ? (
          <p className="mt-3 rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-900">
            Next live lesson ({nextLiveLesson.cohortName}):{" "}
            <span className="font-semibold">
              {new Date(nextLiveLesson.nextLessonAt).toLocaleString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "UTC",
              })}
            </span>
            {nextLiveLesson.totalLessons > 0 ? (
              <span className="text-violet-700">
                {" "}
                · {nextLiveLesson.completedCount}/{nextLiveLesson.totalLessons} logged
              </span>
            ) : null}
          </p>
        ) : null}
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
