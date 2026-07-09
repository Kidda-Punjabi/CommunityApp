import { HomeHeroLink } from "@/components/home/home-hero-link";
import { HomeGreetingHeader } from "@/components/home-greeting-header";
import { HomeActionList } from "@/components/home/home-action-list";
import {
  HomeStreakBanner,
  HomeStreakProvider,
} from "@/components/home-streak-stats";
import { HubCard } from "@/components/ui/hub-primitives";
import { getHomeTabData } from "@/lib/cache/tab-page-cache";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  const { dashboard, profile, onboarding, unreadNotificationCount, weeklyPoints } =
    await getHomeTabData(session.user.id);

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
          weeklyPoints={weeklyPoints}
        />

        <section className={ui.section}>
          <HomeHeroLink href={dashboard.primaryCta.href} label={dashboard.primaryCta.label} />
        </section>

        <HomeStreakBanner />

        <section className={ui.section}>
          <HomeActionList
            membersStudiedTodayLabel={dashboard.membersStudiedTodayLabel}
            showLiveTranslate={dashboard.showLiveTranslate}
            showPhotoTranslate={dashboard.showPhotoTranslate}
          />
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
