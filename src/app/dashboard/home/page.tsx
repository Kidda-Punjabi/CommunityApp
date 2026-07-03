import { HomeGreetingHeader } from "@/components/home-greeting-header";
import { HomeActionList } from "@/components/home/home-action-list";
import { HomeStatsBar } from "@/components/home/home-stats-bar";
import {
  HomeStreakBanner,
  HomeStreakProvider,
} from "@/components/home-streak-stats";
import { HubCard } from "@/components/ui/hub-primitives";
import { getHomeDashboardData } from "@/lib/dashboard/home-data";
import { loadViewerWeeklyPoints } from "@/lib/leaderboard/load-viewer-weekly-points";
import { getCurrentWeekStart } from "@/lib/leaderboard/week";
import { loadUnreadNotificationCount } from "@/lib/notifications/load-notifications";
import { loadOnboardingProfile } from "@/lib/progression/load-user-progression";
import { getUserActivityDate } from "@/lib/progress/server-activity-date";
import { loadEditableProfile } from "@/lib/profile/load-editable-profile";
import { ui } from "@/lib/ui/styles";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const activityDate = await getUserActivityDate();
  const currentWeekStart = getCurrentWeekStart(activityDate);

  const [dashboard, profile, onboarding, unreadNotificationCount, weeklyPoints] =
    await Promise.all([
      getHomeDashboardData(supabase, user!),
      loadEditableProfile(supabase, user!.id),
      loadOnboardingProfile(supabase, user!.id),
      loadUnreadNotificationCount(supabase, user!.id),
      loadViewerWeeklyPoints(supabase, user!.id, currentWeekStart),
    ]);

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
        <HomeGreetingHeader
          displayName={dashboard.displayName}
          profile={{
            full_name: profile?.full_name ?? null,
            preferred_name: profile?.preferred_name ?? null,
            avatar_url: profile?.avatar_url ?? null,
          }}
          learnerLevel={onboarding.learnerLevel}
          unreadNotificationCount={unreadNotificationCount}
        />

        <section className={ui.section}>
          <Link href={dashboard.primaryCta.href} className={ui.heroCard}>
            <span className={ui.heroBadge}>Up next</span>
            <p className={ui.heroTitle}>{dashboard.primaryCta.label}</p>
            <p className={ui.heroSubtitle}>Tap to continue your learning</p>
            <span className={ui.heroCta}>Get started →</span>
          </Link>
        </section>

        <HomeStreakBanner />

        <section className={ui.section}>
          <HomeStatsBar
            lessonsCompleted={dashboard.stats.lessonsCompleted}
            quizzesPassed={dashboard.stats.quizzesPassed}
            weeklyPoints={weeklyPoints}
          />
        </section>

        <section className={ui.section}>
          <HomeActionList membersStudiedTodayLabel={dashboard.membersStudiedTodayLabel} />
        </section>

        {dashboard.showStarterPack && (
          <section className={ui.section}>
            <HubCard>
              <p className="text-xs font-medium text-zinc-500">Free starter pack</p>
              <h2 className="mt-1 text-lg font-medium text-zinc-900">
                Survival Phrases &amp; comprehensible input
              </h2>
              <p className="mt-2 text-sm text-zinc-600">
                Start with free lessons designed to get you speaking from day one.
              </p>
              <Link
                href={dashboard.starterPackHref}
                className={`mt-4 ${ui.btnPrimary}`}
              >
                Start free lessons
              </Link>
            </HubCard>
          </section>
        )}

        {dashboard.isFreeTier && (
          <section className={ui.section}>
            <HubCard>
              <h2 className="text-lg font-medium text-zinc-900">
                Unlock the full Foundational course
              </h2>
              <p className="mt-2 text-sm text-zinc-500">
                Go beyond the starter pack with pronunciation, core vocabulary, and guided
                lessons at your own pace.
              </p>
              <Link href="/courses" className={`mt-4 ${ui.btnPrimary}`}>
                View courses
              </Link>
            </HubCard>
          </section>
        )}

      </HomeStreakProvider>
    </div>
  );
}
