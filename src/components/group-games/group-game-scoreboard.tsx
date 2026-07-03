"use client";

import { ui } from "@/lib/ui/styles";

export type ScoreboardEntry = {
  userId: string;
  displayName: string;
  score: number;
};

type GroupGameScoreboardProps = {
  entries: ScoreboardEntry[];
  currentUserId: string;
};

export function GroupGameScoreboard({ entries, currentUserId }: GroupGameScoreboardProps) {
  const sorted = [...entries].sort((a, b) => b.score - a.score);

  return (
    <section className={`${ui.card} space-y-2`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Scoreboard</p>
      <ul className="space-y-1.5">
        {sorted.map((entry) => (
          <li key={entry.userId} className="flex items-center justify-between text-sm">
            <span className="truncate text-zinc-700">
              {entry.displayName}
              {entry.userId === currentUserId ? " (you)" : ""}
            </span>
            <span className="font-semibold text-violet-600">{entry.score}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
