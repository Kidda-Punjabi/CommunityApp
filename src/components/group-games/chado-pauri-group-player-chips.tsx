"use client";

import type { LadderRunRow, LadderScoreboardEntry } from "@/lib/chado-pauri-group/types";

type ChadoPauriGroupPlayerChipsProps = {
  runs: LadderRunRow[];
  entries: LadderScoreboardEntry[];
  currentUserId: string;
};

function chipInitial(displayName: string): string {
  const trimmed = displayName.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}

export function ChadoPauriGroupPlayerChips({
  runs,
  entries,
  currentUserId,
}: ChadoPauriGroupPlayerChipsProps) {
  const scoreByUser = new Map(entries.map((e) => [e.userId, e]));
  const ordered = [...runs].sort((a, b) => a.turn_order - b.turn_order);

  if (ordered.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {ordered.map((run) => {
        const entry = scoreByUser.get(run.player_id);
        const name = entry?.displayName ?? "Player";
        const isActive = run.status === "active";
        const isYou = run.player_id === currentUserId;
        const isDone = run.status === "completed";

        return (
          <div
            key={run.id}
            className={`flex min-w-0 shrink-0 items-center gap-2 rounded-full border px-2 py-1.5 ${
              isActive
                ? "border-violet-300 bg-violet-600 text-white"
                : "border-zinc-200 bg-white text-zinc-800"
            } ${isDone && !isActive ? "opacity-55" : ""}`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                isActive ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-600"
              }`}
              aria-hidden
            >
              {chipInitial(name)}
            </span>
            <div className="min-w-0 pr-0.5">
              <p
                className={`max-w-[5.5rem] truncate text-xs font-semibold sm:max-w-[7rem] ${
                  isActive ? "text-white" : "text-zinc-800"
                }`}
              >
                {name}
                {isYou ? " (you)" : ""}
              </p>
              <p
                className={`text-[11px] font-bold tabular-nums ${
                  isActive ? "text-violet-100" : "text-violet-600"
                }`}
              >
                {entry?.score ?? 0} pts
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
