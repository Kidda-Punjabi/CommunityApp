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
  /** One row of score chips (Buzz-in) instead of the full card. */
  compact?: boolean;
};

export function GroupGameScoreboard({
  entries,
  currentUserId,
  compact = false,
}: GroupGameScoreboardProps) {
  const sorted = [...entries].sort((a, b) => b.score - a.score);

  if (compact) {
    return (
      <ul className="flex gap-2 overflow-x-auto" aria-label="Scoreboard">
        {sorted.map((entry) => {
          const me = entry.userId === currentUserId;
          return (
            <li
              key={entry.userId}
              className={`flex h-10 min-w-[6.5rem] flex-1 items-center justify-between gap-2 rounded-xl px-3 text-sm ${
                me
                  ? "bg-violet-600 font-bold text-white"
                  : "border border-zinc-200 bg-white font-semibold text-zinc-800"
              }`}
            >
              <span className="truncate">{me ? "You" : entry.displayName}</span>
              <span className="tabular-nums">{entry.score}</span>
            </li>
          );
        })}
      </ul>
    );
  }

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
