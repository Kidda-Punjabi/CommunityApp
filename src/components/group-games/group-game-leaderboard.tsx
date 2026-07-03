"use client";

import Link from "next/link";
import type { ScoreboardEntry } from "@/components/group-games/group-game-scoreboard";
import { ui } from "@/lib/ui/styles";

type GroupGameLeaderboardProps = {
  title: string;
  subtitle?: string;
  entries: ScoreboardEntry[];
  currentUserId: string;
};

export function GroupGameLeaderboard({
  title,
  subtitle = "Final scores",
  entries,
  currentUserId,
}: GroupGameLeaderboardProps) {
  const sorted = [...entries].sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">{title}</p>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">{subtitle}</h1>
      </div>

      <ol className={`${ui.card} divide-y divide-zinc-100`}>
        {sorted.map((entry, index) => (
          <li key={entry.userId} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <span className="w-6 text-center text-sm font-bold text-zinc-400">{index + 1}</span>
            <span className="min-w-0 flex-1 font-medium text-zinc-900">
              {entry.displayName}
              {entry.userId === currentUserId ? " (you)" : ""}
            </span>
            <span className="font-semibold text-violet-600">{entry.score}</span>
          </li>
        ))}
      </ol>

      <Link href="/dashboard/group-games" className={`${ui.btnSecondary} w-full justify-center`}>
        Back to group games
      </Link>
    </div>
  );
}
