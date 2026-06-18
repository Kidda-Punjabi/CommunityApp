"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { StreakRescueBanner } from "@/components/streak-rescue-banner";
import { getLocalActivityDate } from "@/lib/progress/activity-date";
import {
  getStreakPresentation,
  syncStreakState,
} from "@/app/dashboard/home/streak-actions";

export type HomeStreakInitial = {
  streak: number;
  longestStreak: number;
  redemptionAvailable: boolean;
  streakAtRisk: boolean;
  streakWarning: boolean;
  rescueStreak: number;
};

type HomeStreakState = HomeStreakInitial;

const HomeStreakContext = createContext<HomeStreakState | null>(null);

function useHomeStreakStats() {
  const value = useContext(HomeStreakContext);
  if (!value) {
    throw new Error("HomeStreak components must be used within HomeStreakProvider");
  }
  return value;
}

export function HomeStreakProvider({
  initial,
  children,
}: {
  initial: HomeStreakInitial;
  children: ReactNode;
}) {
  const [stats, setStats] = useState(initial);

  useEffect(() => {
    const today = getLocalActivityDate();

    void getStreakPresentation(today).then((result) => {
      if ("error" in result) return;

      setStats({
        streak: result.streak,
        longestStreak: result.longestStreak,
        redemptionAvailable: result.redemptionAvailable,
        streakAtRisk: result.streakAtRisk,
        streakWarning: result.streakWarning,
        rescueStreak: result.rescueStreak,
      });
    });

    void syncStreakState(today);
  }, []);

  return (
    <HomeStreakContext.Provider value={stats}>{children}</HomeStreakContext.Provider>
  );
}

export function HomeStreakBanner() {
  const stats = useHomeStreakStats();

  if (!stats.redemptionAvailable) return null;

  return <StreakRescueBanner currentStreak={stats.rescueStreak} />;
}

export function HomeStreakCard() {
  const stats = useHomeStreakStats();

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Streak
      </p>
      <p className="mt-1 text-sm font-bold text-zinc-900">
        {stats.streak > 0 ? (
          <>
            <span aria-hidden="true">{stats.streakWarning ? "🟠" : "🔥"} </span>
            {stats.streak} day streak
          </>
        ) : (
          "No streak yet"
        )}
      </p>
      {stats.streakAtRisk && !stats.redemptionAvailable && (
        <p className="mt-1 text-xs font-medium text-amber-600">
          Study today to keep it going
        </p>
      )}
      <p className="mt-1 text-xs text-zinc-500">
        Best:{" "}
        {stats.longestStreak > 0
          ? `${stats.longestStreak} day${stats.longestStreak === 1 ? "" : "s"}`
          : "—"}
      </p>
    </div>
  );
}
