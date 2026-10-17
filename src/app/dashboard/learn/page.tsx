import { HomeGreetingHeader } from "@/components/home-greeting-header";
import {
  HomeStreakBanner,
  HomeStreakProvider,
} from "@/components/home-streak-stats";
import { courseWhen, HomeOneScreen } from "@/components/learn/home-one-screen";
import {
  OlderKidBeginnerCard,
  OlderKidComingSoonRow,
  OlderKidSecondaryTiles,
} from "@/components/learn/older-kid-home";
import { getHomeTabData } from "@/lib/cache/tab-page-cache";
import { fetchLearnContent, filterLessonsForCourse } from "@/lib/learning/load-learn-content";
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
import { loadAdultClassCards } from "@/lib/learning/load-adult-class-cards";
import { getLearnTrack, learnTrackPath } from "@/lib/learning/learn-catalog";
import { NATIVE_LOCKED_MESSAGE } from "@/lib/native/copy";
import { getIsNativeApp } from "@/lib/native/platform-server";
import { courseDetailPath } from "@/lib/learn/course-levels";
import { loadRegisteredComingSoonLevels } from "@/lib/learn/course-interest";
import { loadKidProgressSummariesForParent } from "@/lib/kids/load-kid-progress-summary";
import { findCoursesForTier } from "@/lib/membership/courses";
import { resolveCourseActor } from "@/lib/kids/course-actor";
import {
  getCachedAuthSession,
  getCachedCourseAccess,
} from "@/lib/supabase/cached-session";
import { memberNeedsLiveCheckIn } from "@/lib/community/check-in-by-code";
import { xpRoad, xpTargetForLevel } from "@/lib/community/level-progress";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { bandForLevel, bandLabel, levelFillVar } from "@/lib/community/levels";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";
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
  const actorPromise = resolveCourseActor(supabase, user.id);
  const [
    homeTab,
    access,
    allLessons,
    completionMap,
    actor,
    kidsCourses,
    kidProfileCount,
    registeredInterest,
    kidProgressSummaries,
  ] = await Promise.all([
    getHomeTabData(user.id),
    getCachedCourseAccess(supabase, user),
    lessonsPromise,
    lessonsPromise.then((lessons) =>
      fetchLessonCompletionMap(supabase, user.id, lessons)
    ),
    actorPromise,
    fetchAccessibleKidsCourses(supabase, user.id),
    supabase
      .from("kid_profiles")
      .select("id", { count: "exact", head: true })
      .eq("parent_user_id", user.id)
      .then(({ count }) => count ?? 0),
    loadRegisteredComingSoonLevels(supabase, user.id),
    actorPromise.then((resolved) =>
      resolved.kind === "kid"
        ? Promise.resolve([])
        : loadKidProgressSummariesForParent(supabase, user.id)
    ),
  ]);

  const { dashboard, profile, onboarding, unreadNotificationCount } = homeTab;

  const greeting = (
    <>
      <HomeGreetingHeader
        displayName={dashboard.displayName}
        profile={{
          full_name: profile?.full_name ?? null,
          preferred_name: profile?.preferred_name ?? null,
          avatar_url: profile?.avatar_url ?? null,
        }}
        kidAvatarIcon={actor.kind === "kid" ? null : dashboard.kidAvatarIcon}
        avatarInitial={
          actor.kind === "kid" ? (dashboard.displayName?.charAt(0) ?? "K").toUpperCase() : null
        }
        className="mb-2"
        learnerLevel={actor.kind === "kid" ? null : onboarding.learnerLevel}
        unreadNotificationCount={unreadNotificationCount}
        weeklyPoints={dashboard.headerPoints}
        profileHref={dashboard.profileHref}
      />
      <HomeStreakBanner />
    </>
  );

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

  const nativeApp = await getIsNativeApp();
  const lockedLabel = nativeApp ? NATIVE_LOCKED_MESSAGE : "Unlock to start";

  const foundationalStatus = foundationalLocked
    ? lockedLabel
    : foundationalProgress && foundationalProgress.totalLessons > 0
      ? `${foundationalProgress.completedLessons} of ${foundationalProgress.totalLessons} lessons`
      : "Lessons ready";

  const beginnersStatus = beginnersLocked
    ? lockedLabel
    : beginnersGate?.gated
      ? shortStartsStatus(beginnersGate.startDate)
      : "Lessons ready";

  const communityStatus = communityLocked ? lockedLabel : "Lessons ready";
  const communityHref = communityLocked
    ? nativeApp
      ? ""
      : community.unlockUrl ?? "/courses/community"
    : learnTrackPath("community");

  const classCards =
    actor.kind === "kid" || kidProfileCount === 0
      ? []
      : await loadAdultClassCards(supabase, user.id);
  const classTiers = new Set(classCards.map((card) => card.tier));

  if (actor.kind === "kid") {
    const enrolledAdult = access.courses.find(
      (course) =>
        access.unlockedCourseIds.has(course.id) &&
        (course.required_tier === "beginners" || course.required_tier === "foundational")
    );
    if (enrolledAdult?.required_tier === "beginners" || enrolledAdult?.required_tier === "foundational") {
      const trackId = enrolledAdult.required_tier;
      const adultLessons = filterLessonsForTrack(allLessons, access.courses, trackId).filter((lesson) =>
        canAccessLessonInContext(access, lesson)
      );
      const adultProgress = summarizeCourseProgress(adultLessons, completionMap);
      const adultPercent =
        adultProgress.totalLessons > 0
          ? Math.round((adultProgress.completedLessons / adultProgress.totalLessons) * 100)
          : null;
      return (
        <div className={ui.page}>
          <HomeStreakProvider
            initial={{
              streak: dashboard.stats.streak,
              longestStreak: dashboard.stats.longestStreak,
              redemptionAvailable: dashboard.stats.redemptionAvailable,
              streakAtRisk: dashboard.stats.streakAtRisk,
              streakWarning: dashboard.stats.streakWarning,
              rescueStreak: dashboard.stats.rescueStreak,
            }}
          >
            {greeting}
            <Link
              href={learnTrackPath(trackId)}
              className="block rounded-3xl bg-white p-4 shadow-sm"
            >
              <p className="font-heading text-base font-semibold text-zinc-900">{enrolledAdult.name}</p>
              <p className="mt-1 text-sm text-zinc-600">
                {adultPercent != null ? `${adultPercent}% of lessons` : "Open this week's lesson"}
              </p>
            </Link>
          </HomeStreakProvider>
        </div>
      );
    }

    const beginnerCourse = kidsCourses[0] ?? null;
    const beginnerLessons = beginnerCourse
      ? filterLessonsForCourse(allLessons, beginnerCourse.id)
      : [];
    const beginnerProgress = beginnerCourse
      ? summarizeCourseProgress(beginnerLessons, completionMap)
      : null;
    const beginnerPercent =
      beginnerProgress && beginnerProgress.totalLessons > 0
        ? Math.round((beginnerProgress.completedLessons / beginnerProgress.totalLessons) * 100)
        : null;

    return (
      <div className={ui.page}>
        <HomeStreakProvider
          initial={{
            streak: dashboard.stats.streak,
            longestStreak: dashboard.stats.longestStreak,
            redemptionAvailable: dashboard.stats.redemptionAvailable,
            streakAtRisk: dashboard.stats.streakAtRisk,
            streakWarning: dashboard.stats.streakWarning,
            rescueStreak: dashboard.stats.rescueStreak,
          }}
        >
          {greeting}
          <div className="space-y-3">
            <OlderKidBeginnerCard
              level1Href={beginnerCourse ? kidsCourseLearnPath(beginnerCourse.id) : null}
              level1Percent={beginnerPercent}
            />
            <OlderKidComingSoonRow
              title="Intermediate"
              courseLevel="kids_intermediate"
              interestRegistered={registeredInterest.has("kids_intermediate")}
            />
            <OlderKidComingSoonRow
              title="Advanced"
              courseLevel="kids_advanced"
              interestRegistered={registeredInterest.has("kids_advanced")}
            />
            <OlderKidSecondaryTiles />
          </div>
        </HomeStreakProvider>
      </div>
    );
  }

  const [{ data: me }, { data: levelSettings }] = await Promise.all([
    supabase.from("profiles").select("kidda_level, total_xp, xp_at_level_start, timezone").eq("id", user.id).maybeSingle(),
    supabase.from("community_level_settings").select("xp_to_unlock").eq("id", 1).maybeSingle(),
  ]);
  const kiddaLevel = me?.kidda_level as number | null;
  const timeZone = (me?.timezone as string) || "Europe/London";
  const earned = Math.max(0, Number(me?.total_xp ?? 0) - Number(me?.xp_at_level_start ?? 0));
  const target = kiddaLevel == null ? null : xpTargetForLevel(kiddaLevel, (levelSettings?.xp_to_unlock as Record<string, number> | null) ?? null);
  const road = target == null ? null : xpRoad(earned, target);
  const foundationalClass = courseWhen(classCards, "foundational", timeZone);
  const beginnersClass = courseWhen(classCards, "beginners", timeZone);
  const communityLiveCheckIn = communityLocked ? false : await memberNeedsLiveCheckIn(createServiceRoleClient(), user.id);

  return (
    <div className={`${ui.page} !flex !h-[calc(100dvh-5.5rem-env(safe-area-inset-bottom))] !flex-col !overflow-hidden !py-3`}>
      <HomeStreakProvider
        initial={{
          streak: dashboard.stats.streak,
          longestStreak: dashboard.stats.longestStreak,
          redemptionAvailable: dashboard.stats.redemptionAvailable,
          streakAtRisk: dashboard.stats.streakAtRisk,
          streakWarning: dashboard.stats.streakWarning,
          rescueStreak: dashboard.stats.rescueStreak,
        }}
      >
        {greeting}
        {kiddaLevel == null ? null : (
          <Link href="/dashboard/community/level" className="mb-2 flex items-center gap-3 rounded-[20px] bg-white px-3 py-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-extrabold text-white" style={{ background: "#5B21B6", boxShadow: `0 0 0 3px ${levelFillVar(kiddaLevel)}` }}>{kiddaLevel}</span>
            <span>
              <span className="block text-sm font-extrabold text-[#1F1640]">Level {kiddaLevel} · {bandLabel(bandForLevel(kiddaLevel))}</span>
              <span className="block text-[11px] font-semibold text-[#6B5F8A]">{road ? `${road.earned} of ${road.target} XP to your Level ${kiddaLevel + 1} check` : "Top level"}</span>
              <span className="block text-[11px] text-[#6B5F8A]">Live sessions earn the most XP</span>
            </span>
          </Link>
        )}
        <HomeOneScreen
          timeZone={timeZone}
          communityHref={communityHref}
          communityStatus={communityStatus}
          communityLocked={communityLocked}
          communityLiveCheckIn={communityLiveCheckIn}
          kids={kidProgressSummaries}
          courses={[
            {
              key: "foundational",
              title: "Foundational",
              href: foundationalLocked ? undefined : learnTrackPath("foundational"),
              enrolled: !foundationalLocked,
              comingSoon: false,
              weekLesson: foundationalClass.weekLesson,
              when: foundationalClass.when,
              fill: "#E4DFEE",
              ink: "#4B4366",
            },
            {
              key: "beginners",
              title: "Beginners",
              href: beginnersLocked ? undefined : learnTrackPath("beginners"),
              enrolled: !beginnersLocked,
              comingSoon: false,
              weekLesson: beginnersClass.weekLesson,
              when: beginnersClass.when,
              fill: "#FDE68A",
              ink: "#5A3B00",
            },
            {
              key: "intermediate",
              title: "Intermediate",
              enrolled: false,
              comingSoon: true,
              interestRegistered: registeredInterest.has("intermediate"),
              weekLesson: null,
              when: null,
              fill: "#DFF8EF",
              ink: "#075E47",
            },
            {
              key: "advanced",
              title: "Advanced",
              enrolled: false,
              comingSoon: true,
              interestRegistered: registeredInterest.has("advanced"),
              weekLesson: null,
              when: null,
              fill: "#F1ECFF",
              ink: "#3B1A8C",
            },
          ]}
        />
      </HomeStreakProvider>
    </div>
  );
}
