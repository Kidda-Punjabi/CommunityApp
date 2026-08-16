import { LearnCertificatesButton } from "@/components/learn/learn-certificates-button";
import { LearnCourseRow } from "@/components/learn/learn-course-row";
import { LearnCourseTiles, type LearnHubTile } from "@/components/learn/learn-course-tiles";
import { LearnKidsProgressLink } from "@/components/learn/learn-kids-progress-link";
import { LearnSecondaryTiles } from "@/components/learn/learn-secondary-tiles";
import { fetchLearnContent } from "@/lib/learning/load-learn-content";
import {
  canAccessLessonInContext,
  filterLessonsForTrack,
  isLearnTrackUnlocked,
} from "@/lib/learning/learn-access";
import { resolveGroupCohortContentGate } from "@/lib/learning/group-cohort-content-gate";
import {
  fetchAccessibleKidsCourses,
  kidsCourseLearnPath,
} from "@/lib/learning/kids-courses";
import { kidsCourseHubStatus } from "@/lib/learning/kids-cohort-display";
import { getLearnTrack, learnTrackPath } from "@/lib/learning/learn-catalog";
import { courseDetailPath } from "@/lib/learn/course-levels";
import { loadRegisteredComingSoonLevels } from "@/lib/learn/course-interest";
import { findCoursesForTier } from "@/lib/membership/courses";
import { resolveCourseActor } from "@/lib/kids/course-actor";
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

function shortStartsStatus(startDate: string): string {
  const day = startDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "Starts soon";
  const label = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
  return `Starts ${label}`;
}

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
  const [access, allLessons, completionMap, actor, kidsCourses, kidProfileCount, registeredInterest] =
    await Promise.all([
      getCachedCourseAccess(supabase, user),
      lessonsPromise,
      lessonsPromise.then((lessons) =>
        fetchLessonCompletionMap(supabase, user.id, lessons)
      ),
      resolveCourseActor(supabase, user.id),
      fetchAccessibleKidsCourses(supabase, user.id),
      supabase
        .from("kid_profiles")
        .select("id", { count: "exact", head: true })
        .eq("parent_user_id", user.id)
        .then(({ count }) => count ?? 0),
      loadRegisteredComingSoonLevels(supabase, user.id),
    ]);

  const foundational = getLearnTrack("foundational")!;
  const beginners = getLearnTrack("beginners")!;
  const community = getLearnTrack("community")!;

  const foundationalLocked = !isLearnTrackUnlocked(foundational, access);
  const beginnersLocked = !isLearnTrackUnlocked(beginners, access);
  const communityLocked = !isLearnTrackUnlocked(community, access);

  const foundationalLessons = filterLessonsForTrack(
    allLessons,
    access.courses,
    "foundational"
  );
  const beginnersCourseIds = findCoursesForTier(access.courses, "beginners").map(
    (c) => c.id
  );

  let beginnersGate: Awaited<ReturnType<typeof resolveGroupCohortContentGate>> = null;
  if (!beginnersLocked) {
    beginnersGate = await resolveGroupCohortContentGate(
      supabase,
      user.id,
      beginnersCourseIds
    );
  }

  const foundationalAccessible = foundationalLocked
    ? []
    : foundationalLessons.filter((lesson) => canAccessLessonInContext(access, lesson));
  const foundationalProgress = foundationalLocked
    ? null
    : summarizeCourseProgress(foundationalAccessible, completionMap);

  const foundationalPercent =
    foundationalProgress && foundationalProgress.totalLessons > 0
      ? Math.round(
          (foundationalProgress.completedLessons / foundationalProgress.totalLessons) * 100
        )
      : null;

  const foundationalStatus = foundationalLocked
    ? "Unlock to start"
    : foundationalProgress && foundationalProgress.totalLessons > 0
      ? `${foundationalProgress.completedLessons} of ${foundationalProgress.totalLessons} lessons`
      : "Lessons ready";

  const beginnersStatus = beginnersLocked
    ? "Unlock to start"
    : beginnersGate?.gated
      ? shortStartsStatus(beginnersGate.startDate)
      : "Lessons ready";

  const communityStatus = communityLocked ? "Unlock to start" : "Lessons ready";
  const communityHref = communityLocked
    ? community.unlockUrl ?? "/courses/community"
    : learnTrackPath("community");

  const kidsTiles: LearnHubTile[] = kidsCourses.map((course) => ({
    id: `kids-${course.id}`,
    kind: "kids-course" as const,
    href: kidsCourseLearnPath(course.id),
    title: course.name,
    status: kidsCourseHubStatus({
      cohortName: course.cohortName,
      startDate: course.startDate,
      gated: course.gated,
    }),
    tone: "accent" as const,
  }));

  if (actor.kind === "kid") {
    const tiles: LearnHubTile[] =
      kidsTiles.length > 0
        ? kidsTiles
        : [
            {
              id: "more",
              kind: "static",
              title: "Your courses",
              status: "Your class will show here once you're enrolled",
              tone: "muted",
            },
          ];

    return (
      <div className={ui.page}>
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Learn</h1>
            <p className="mt-1 text-sm text-zinc-500">Courses and tools in one place.</p>
          </div>
          <LearnCertificatesButton />
        </div>
        <LearnCourseTiles tiles={tiles} />
      </div>
    );
  }

  return (
    <div className={ui.page}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Learn</h1>
          <p className="mt-1 text-sm text-zinc-500">Courses and tools in one place.</p>
        </div>
        <LearnCertificatesButton />
      </div>

      {kidsTiles.length > 0 ? (
        <div className="mb-5">
          <LearnCourseTiles tiles={kidsTiles} />
        </div>
      ) : null}

      <div className="space-y-3">
        <LearnCourseRow
          level="foundational"
          tourId="learn-tile-foundational"
          href={
            foundationalLocked
              ? foundational.unlockUrl ?? "/courses/foundational"
              : learnTrackPath("foundational")
          }
          status={foundationalStatus}
          percent={foundationalLocked ? null : foundationalPercent}
        />
        <LearnCourseRow
          level="beginners"
          tourId="learn-tile-beginners"
          href={
            beginnersLocked
              ? beginners.unlockUrl ?? "/courses/beginners"
              : learnTrackPath("beginners")
          }
          status={beginnersStatus}
        />
        <LearnCourseRow
          level="intermediate"
          href={courseDetailPath("intermediate")}
          status="Next after Beginner"
          comingSoon
          interestRegistered={registeredInterest.has("intermediate")}
        />
        <LearnCourseRow
          level="advanced"
          href={courseDetailPath("advanced")}
          status="Next after Intermediate"
          comingSoon
          interestRegistered={registeredInterest.has("advanced")}
        />
      </div>

      <div className="mt-6 space-y-3">
        {kidProfileCount > 0 ? <LearnKidsProgressLink /> : null}
        <LearnSecondaryTiles
          communityHref={communityHref}
          communityStatus={communityStatus}
          communityLocked={communityLocked}
        />
      </div>
    </div>
  );
}
