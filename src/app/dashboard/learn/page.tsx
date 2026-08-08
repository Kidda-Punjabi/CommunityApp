import { LearnCourseTiles, type LearnHubTile } from "@/components/learn/learn-course-tiles";
import { fetchLearnContent } from "@/lib/learning/load-learn-content";
import {
  canAccessLessonInContext,
  filterLessonsForTrack,
  isLearnTrackUnlocked,
} from "@/lib/learning/learn-access";
import { resolveGroupCohortContentGate } from "@/lib/learning/group-cohort-content-gate";
import { getLearnTrack, learnTrackPath } from "@/lib/learning/learn-catalog";
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
  const [access, allLessons, completionMap] =
    await Promise.all([
      getCachedCourseAccess(supabase, user),
      lessonsPromise,
      lessonsPromise.then((lessons) =>
        fetchLessonCompletionMap(supabase, user.id, lessons)
      ),
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

  const tiles: LearnHubTile[] = [
    {
      id: "foundational",
      kind: "link",
      href: foundationalLocked
        ? foundational.unlockUrl ?? "/courses/foundational"
        : learnTrackPath("foundational"),
      title: "Foundational course",
      status: foundationalStatus,
      percent: foundationalLocked ? null : foundationalPercent,
      tone: "accent",
    },
    {
      id: "beginners",
      kind: "link",
      href: beginnersLocked
        ? beginners.unlockUrl ?? "/courses/beginners"
        : learnTrackPath("beginners"),
      title: "Beginners course",
      status: beginnersStatus,
      tone: "amber",
    },
    {
      id: "community",
      kind: "link",
      href: communityLocked
        ? community.unlockUrl ?? "/courses/community"
        : learnTrackPath("community"),
      title: "Community",
      status: communityStatus,
      tone: "rose",
    },
    {
      id: "resources",
      kind: "link",
      href: "/dashboard/learn/resources",
      title: "Resources",
      status: "Tools & shortcuts",
      tone: "sky",
    },
  ];

  return (
    <div className={ui.page}>
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Learn</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Courses and tools in one place.
        </p>
      </div>

      <LearnCourseTiles tiles={tiles} />
    </div>
  );
}
