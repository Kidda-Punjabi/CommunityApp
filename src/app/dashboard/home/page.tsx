import { EventCard } from "@/components/event-card";
import {
  HomeStreakBanner,
  HomeStreakCard,
  HomeStreakProvider,
} from "@/components/home-streak-stats";
import { canAccessEvent } from "@/lib/membership/access";
import { formatRecurrenceLabel } from "@/lib/events/recurrence";
import { getHomeDashboardData } from "@/lib/dashboard/home-data";
import { normalizeTier } from "@/lib/membership/tiers";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const dashboard = await getHomeDashboardData(supabase, user!);

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <section className="mb-6">
        <p className="text-sm font-medium text-violet-600">Welcome back</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">
          Hi, {dashboard.displayName}
        </h1>
        <Link
          href={dashboard.primaryCta.href}
          className="mt-4 block rounded-2xl bg-violet-600 px-5 py-4 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-500"
        >
          {dashboard.primaryCta.label}
        </Link>
      </section>

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
        <HomeStreakBanner />

        <section className="mb-6 grid grid-cols-3 gap-3">
          <HomeStreakCard />
        <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Lessons
          </p>
          <p className="mt-1 text-lg font-bold text-zinc-900">
            {dashboard.stats.lessonsCompleted}
          </p>
          <p className="text-xs text-zinc-500">completed</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Quiz
          </p>
          <p className="mt-1 text-lg font-bold text-zinc-900">
            {dashboard.stats.quizLevelLabel}
          </p>
          <p className="text-xs text-zinc-500">reached</p>
        </div>
      </section>
      </HomeStreakProvider>

      {dashboard.continueItem && (
        <section className="mb-6">
          <h2 className="mb-3 text-lg font-semibold text-zinc-900">
            Continue where you left off
          </h2>
          <Link
            href={dashboard.continueItem.href}
            className="block rounded-2xl border border-violet-200 bg-violet-50/60 p-4 shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-50"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
              {dashboard.continueItem.type === "lesson" && "Lesson"}
              {dashboard.continueItem.type === "quiz" && "Quiz"}
              {dashboard.continueItem.type === "flashcard" && "Flashcards"}
            </p>
            <p className="mt-1 font-semibold text-zinc-900">
              {dashboard.continueItem.title}
            </p>
            <p className="mt-1 text-sm text-zinc-500">{dashboard.continueItem.subtitle}</p>
            <p className="mt-3 text-sm font-semibold text-violet-600">Resume →</p>
          </Link>
        </section>
      )}

      {dashboard.showStarterPack && (
        <section className="mb-6">
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-green-700">
              Free Starter Pack
            </p>
            <h2 className="mt-1 text-lg font-semibold text-zinc-900">
              Survival Phrases &amp; comprehensible input
            </h2>
            <p className="mt-2 text-sm text-zinc-600">
              Start with free lessons designed to get you speaking from day one.
            </p>
            <Link
              href={dashboard.starterPackHref}
              className="mt-4 inline-block rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-600"
            >
              Start free lessons
            </Link>
          </div>
        </section>
      )}

      {dashboard.isFreeTier && (
        <section className="mb-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">
              Unlock the full Foundational course
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              Go beyond the starter pack with pronunciation, core vocabulary, and
              guided lessons at your own pace.
            </p>
            <Link
              href="/dashboard/membership"
              className="mt-4 inline-block rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
            >
              View courses
            </Link>
          </div>
        </section>
      )}

      {dashboard.upcomingEvents.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-900">Upcoming events</h2>
            <Link
              href="/dashboard/events"
              className="text-sm font-semibold text-violet-600 hover:text-violet-500"
            >
              See all
            </Link>
          </div>
          <div className="space-y-3">
            {dashboard.upcomingEvents.map((event) => {
              const requiredTier = event.required_tier
                ? normalizeTier(event.required_tier)
                : null;

              return (
                <EventCard
                  key={event.occurrenceId}
                  event={event}
                  canAccess={canAccessEvent(
                    dashboard.access.unlockedCourseIds,
                    event,
                    dashboard.access.courses
                  )}
                  requiredTier={
                    requiredTier && requiredTier !== "free" ? requiredTier : null
                  }
                  recurrenceLabel={formatRecurrenceLabel(
                    event.recurrence_freq,
                    event.recurrence_until
                  )}
                />
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
