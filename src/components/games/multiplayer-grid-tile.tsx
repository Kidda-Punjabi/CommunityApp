"use client";

import type { MultiplayerHubEntry } from "@/lib/games/hub-config";
import { recordLastPlayedGame } from "@/lib/games/last-played";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";

type MultiplayerGridTileProps = {
  entry: MultiplayerHubEntry;
  personalBest: number | null;
};

function CornerPlayIcon() {
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600"
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-3.5 w-3.5">
        <path d="M8 5.14v14.72a1 1 0 0 0 1.5.86l11.04-7.36a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z" />
      </svg>
    </span>
  );
}

function scoreLabel(personalBest: number | null): string {
  if (personalBest != null && personalBest > 0) {
    return `Best: ${personalBest}`;
  }
  return "Not played yet";
}

export function MultiplayerGridTile({ entry, personalBest }: MultiplayerGridTileProps) {
  return (
    <Link
      href={entry.href}
      onClick={() => recordLastPlayedGame(entry.id)}
      className={`${ui.cardBordered} group relative flex min-h-[8.75rem] flex-col p-4 transition-all hover:border-violet-200 hover:shadow-[0_6px_28px_-6px_rgba(124,58,237,0.12)]`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-xl"
          aria-hidden="true"
        >
          {entry.emoji}
        </span>
        <CornerPlayIcon />
      </div>
      <p
        className={`mt-3 text-[10px] font-semibold uppercase tracking-wider ${entry.badgeClassName}`}
      >
        {entry.badge}
      </p>
      <p className="mt-1 line-clamp-2 font-heading text-sm font-semibold leading-snug text-zinc-900">
        {entry.title}
      </p>
      <p className="mt-auto pt-2 text-xs font-medium text-zinc-500">{scoreLabel(personalBest)}</p>
    </Link>
  );
}
