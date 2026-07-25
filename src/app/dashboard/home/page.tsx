import { HomeGreetingHeader } from "@/components/home-greeting-header";
import {
  HomeStreakBanner,
  HomeStreakProvider,
} from "@/components/home-streak-stats";
import { FreeLessonsPath } from "@/components/learn/free-lessons-path";
import { HubCard } from "@/components/ui/hub-primitives";
import { getHomeTabData } from "@/lib/cache/tab-page-cache";
import { loadEverydayPunjabiPathItems } from "@/lib/free-lessons/load-path-items";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  const supabase = await createClient();
  const [{ dashboard, profile, onboarding, unreadNotificationCount, weeklyPoints }, pathItems] =
    await Promise.all([
      getHomeTabData(session.user.id),
      loadEverydayPunjabiPathItems(supabase, session.user.id),
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
          weeklyPoints={weeklyPoints}
        />

        <HomeStreakBanner />

        <section className={ui.section}>
          <div className="mb-5 text-center">
            <h2 className="font-heading text-xl font-semibold text-zinc-900">
              Everyday Punjabi
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Finish each topic to unlock the next.
            </p>
          </div>
          {pathItems.length > 0 ? (
            <FreeLessonsPath items={pathItems} />
          ) : (
            <p className="text-center text-sm text-zinc-500">
              Topics coming soon.
            </p>
          )}
        </section>

        {dashboard.isFreeTier ? (
          <section className={ui.section}>
            <HubCard>
              <h2 className="text-lg font-medium text-zinc-900">
                Unlock the full Foundational course
              </h2>
              <p className="mt-2 text-sm text-zinc-500">
                Go beyond Everyday Punjabi with pronunciation, core vocabulary, and
                guided lessons at your own pace.
              </p>
              <Link href="/courses" className={`mt-4 ${ui.btnPrimary}`}>
                View courses
              </Link>
            </HubCard>
          </section>
        ) : null}
      </HomeStreakProvider>
    </div>
  );
}
