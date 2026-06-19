import { EventCard } from "@/components/event-card";
import { HomeGreetingHeader } from "@/components/home-greeting-header";
import {
  HomeStreakBanner,
  HomeStreakCard,
  HomeStreakProvider,
} from "@/components/home-streak-stats";
import { canAccessEvent } from "@/lib/membership/access";
import { formatRecurrenceLabel } from "@/lib/events/recurrence";
import { getHomeDashboardData } from "@/lib/dashboard/home-data";
import { loadEditableProfile } from "@/lib/profile/load-editable-profile";
import { ui } from "@/lib/ui/styles";
import { normalizeTier } from "@/lib/membership/tiers";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [dashboard, profile] = await Promise.all([
    getHomeDashboardData(supabase, user!),
    loadEditableProfile(supabase, user!.id),
  ]);

  return (
    <div className={ui.page}>
      <HomeGreetingHeader
        greetingHeading={dashboard.greetingHeading}
        profile={{
          full_name: profile?.full_name ?? null,
          preferred_name: profile?.preferred_name ?? null,
          avatar_url: profile?.avatar_url ?? null,
        }}
      />

      <section className={ui.section}>
        <Link href={dashboard.primaryCta.href} className={ui.heroCard}>
          <span className={ui.heroBadge}>Up next</span>
          <p className={ui.heroTitle}>{dashboard.primaryCta.label}</p>
          <p className={ui.heroSubtitle}>Tap to continue your learning</p>
          <span className={ui.heroCta}>Get started →</span>
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

        <section className={`${ui.section} grid grid-cols-3 gap-3`}>
          <HomeStreakCard />
          <div className={ui.statCard}>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Lessons
            </p>
            <p className="mt-1 text-lg font-bold text-zinc-900">
              {dashboard.stats.lessonsCompleted}
            </p>
            <p className="text-xs text-zinc-500">completed</p>
          </div>
          <div className={ui.statCard}>
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

      <section className={ui.section}>
        <Link href="/dashboard/leaderboard" className={`block ${ui.cardInteractive}`}>
          <div className="flex items-center gap-4">
            <span className={ui.listRowIcon} aria-hidden="true">
              🏆
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
                Community
              </p>
              <p className="mt-0.5 font-heading font-semibold text-zinc-900">
                Weekly leaderboard
              </p>
              <p className="mt-0.5 text-sm text-zinc-500">
                See who&apos;s practised the most this week
              </p>
            </div>
            <span className={ui.btnIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-4 w-4">
                <path d="M8 5.14v14.72a1 1 0 0 0 1.5.86l11.04-7.36a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z" />
              </svg>
            </span>
          </div>
        </Link>
      </section>

      {dashboard.continueItem && (
        <section className={ui.section}>
          <h2 className={ui.sectionTitle}>Continue where you left off</h2>
          <Link href={dashboard.continueItem.href} className={ui.cardInteractive}>
            <div className="flex items-center gap-4">
              <span className={ui.listRowIcon} aria-hidden="true">
                {dashboard.continueItem.type === "lesson" && "📖"}
                {dashboard.continueItem.type === "quiz" && "✓"}
                {dashboard.continueItem.type === "flashcard" && "🃏"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
                  {dashboard.continueItem.type === "lesson" && "Lesson"}
                  {dashboard.continueItem.type === "quiz" && "Quiz"}
                  {dashboard.continueItem.type === "flashcard" && "Flashcards"}
                </p>
                <p className="mt-1 font-semibold text-zinc-900">{dashboard.continueItem.title}</p>
                <p className="mt-0.5 text-sm text-zinc-500">{dashboard.continueItem.subtitle}</p>
                <p className="mt-3 text-sm font-semibold text-violet-600">Resume →</p>
              </div>
            </div>
          </Link>
        </section>
      )}

      {dashboard.showStarterPack && (
        <section className={ui.section}>
          <div className="rounded-3xl border border-green-200/80 bg-green-50 p-5 shadow-[0_4px_24px_-6px_rgba(22,101,52,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-wider text-green-700">
              Free Starter Pack
            </p>
            <h2 className="mt-2 text-lg font-semibold text-zinc-900">
              Survival Phrases &amp; comprehensible input
            </h2>
            <p className="mt-2 text-sm text-zinc-600">
              Start with free lessons designed to get you speaking from day one.
            </p>
            <Link
              href={dashboard.starterPackHref}
              className={`mt-5 ${ui.btnPrimary}`}
            >
              Start free lessons
            </Link>
          </div>
        </section>
      )}

      {dashboard.isFreeTier && (
        <section className={ui.section}>
          <div className={ui.cardBordered}>
            <h2 className="text-lg font-semibold text-zinc-900">
              Unlock the full Foundational course
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              Go beyond the starter pack with pronunciation, core vocabulary, and
              guided lessons at your own pace.
            </p>
            <Link href="/dashboard/membership" className={`mt-5 ${ui.btnPrimary}`}>
              View courses
            </Link>
          </div>
        </section>
      )}

      {dashboard.upcomingEvents.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-900">Upcoming events</h2>
            <Link href="/dashboard/events" className={ui.btnGhost}>
              See all
            </Link>
          </div>
          <div className={ui.stack}>
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
