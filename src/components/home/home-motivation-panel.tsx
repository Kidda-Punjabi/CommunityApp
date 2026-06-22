"use client";

import { useHomeStreakStats } from "@/components/home-streak-stats";
import type { HomeMotivationData } from "@/lib/dashboard/home-data";

function streakMessage(streak: number, studiedToday: boolean): string | null {
  if (streak < 1) return null;
  if (studiedToday) {
    return "You've kept your streak alive today";
  }
  return "A few minutes today keeps your streak going";
}

export function HomeMotivationPanel({ motivation }: { motivation: HomeMotivationData }) {
  const streakStats = useHomeStreakStats();
  const streak = streakStats.streak;
  const message = streakMessage(streak, motivation.studiedToday);

  return (
    <section className="mb-6">
      <div className="rounded-3xl bg-white p-4 shadow-[0_2px_16px_-4px_rgba(24,24,27,0.07)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Streak
            </p>
            {streak > 0 ? (
              <p className="mt-1 text-lg font-bold text-zinc-900">
                <span aria-hidden="true">{streakStats.streakWarning ? "🟠" : "🔥"} </span>
                {streak} day{streak === 1 ? "" : "s"}
              </p>
            ) : (
              <p className="mt-1 text-sm font-semibold text-violet-600">
                Start your streak today
              </p>
            )}
            {message && (
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">{message}</p>
            )}
          </div>
          {streakStats.longestStreak > 0 && (
            <p className="shrink-0 text-right text-xs text-zinc-500">
              Best: {streakStats.longestStreak} day
              {streakStats.longestStreak === 1 ? "" : "s"}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
