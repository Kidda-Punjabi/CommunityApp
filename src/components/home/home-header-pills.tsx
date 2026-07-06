"use client";

import { Flame, Star } from "lucide-react";
import {
  isHomeStreakAtRisk,
  useHomeStreakStats,
} from "@/components/home-streak-stats";

type HomeHeaderPillsProps = {
  weeklyPoints: number;
};

export function HomeHeaderPills({ weeklyPoints }: HomeHeaderPillsProps) {
  const streakStats = useHomeStreakStats();
  const atRisk = isHomeStreakAtRisk(streakStats);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
          atRisk ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
        }`}
      >
        <Flame className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {streakStats.streak}
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium tabular-nums text-violet-800">
        <Star className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {weeklyPoints}
      </span>
    </div>
  );
}
