"use client";

import type { LadderScoreboardEntry } from "@/lib/chado-pauri-group/types";

type ChadoPauriGroupPlayerChipsProps = {
  turnOrder: string[];
  entries: LadderScoreboardEntry[];
  hotSeatPlayerId: string | null;
  currentUserId: string;
};

function chipInitial(displayName: string): string {
  const trimmed = displayName.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}

export function ChadoPauriGroupPlayerChips({
  turnOrder,
  entries,
  hotSeatPlayerId,
  currentUserId,
}: ChadoPauriGroupPlayerChipsProps) {
  const nameByUser = new Map(entries.map((e) => [e.userId, e.displayName]));

  if (turnOrder.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {turnOrder.map((userId) => {
        const name = nameByUser.get(userId) ?? "Player";
        const isActive = userId === hotSeatPlayerId;
        const isYou = userId === currentUserId;

        return (
          <div
            key={userId}
            className={`flex min-w-0 shrink-0 items-center gap-2 rounded-full border px-2.5 py-1.5 ${
              isActive
                ? "border-violet-300 bg-violet-600 text-white"
                : "border-zinc-200 bg-white text-zinc-800"
            }`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                isActive ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-600"
              }`}
              aria-hidden
            >
              {chipInitial(name)}
            </span>
            <p
              className={`max-w-[6rem] truncate text-xs font-semibold sm:max-w-[7.5rem] ${
                isActive ? "text-white" : "text-zinc-800"
              }`}
            >
              {name}
              {isYou ? " (you)" : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}
