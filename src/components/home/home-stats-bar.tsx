"use client";

import { useHomeStreakStats } from "@/components/home-streak-stats";
import { HubCard, HubGhostLink } from "@/components/ui/hub-primitives";

type HomeStatsBarProps = {
  lessonsCompleted: number;
  quizzesPassed: number;
  weeklyPoints: number;
};

function StatColumn({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0 flex-1 px-1 text-center">
      <p className="text-lg font-medium tabular-nums text-zinc-900">{value}</p>
      <p className="mt-0.5 text-[11px] text-zinc-500">{label}</p>
    </div>
  );
}

export function HomeStatsBar({
  lessonsCompleted,
  quizzesPassed,
  weeklyPoints,
}: HomeStatsBarProps) {
  const streakStats = useHomeStreakStats();

  return (
    <HubCard className="px-4 py-4 sm:px-6">
      <div className="flex items-stretch justify-between divide-x divide-zinc-100">
        <StatColumn value={streakStats.streak} label="Day streak" />
        <StatColumn value={lessonsCompleted} label="Lessons" />
        <StatColumn value={quizzesPassed} label="Quizzes" />
        <StatColumn value={weeklyPoints} label="Points" />
      </div>
      {streakStats.streakAtRisk && !streakStats.redemptionAvailable ? (
        <p className="mt-2 text-center text-xs text-amber-600">
          Study today to keep your streak going
        </p>
      ) : null}
      <div className="mt-3 flex items-center justify-between gap-4 border-t border-zinc-100 pt-3">
        <HubGhostLink href="/dashboard/profile/progress">View progress</HubGhostLink>
        <HubGhostLink href="/dashboard/community#leaderboard">View leaderboard</HubGhostLink>
      </div>
    </HubCard>
  );
}
