"use client";

import { playableHubItem, type PlayableGameId } from "@/lib/games/hub-config";
import { readLastPlayedGame, recordLastPlayedGame, resolvePlayAgainId } from "@/lib/games/last-played";
import Link from "next/link";
import { useEffect, useState } from "react";

export function GamesPlayAgainCard() {
  const [playAgainId, setPlayAgainId] = useState<PlayableGameId>(() =>
    resolvePlayAgainId(null)
  );

  useEffect(() => {
    setPlayAgainId(resolvePlayAgainId(readLastPlayedGame()));
  }, []);

  const game = playableHubItem(playAgainId);
  if (!game) return null;

  return (
    <Link
      href={game.href}
      onClick={() => recordLastPlayedGame(game.id)}
      className="flex items-center gap-3 rounded-2xl bg-violet-600 px-4 py-3 shadow-[0_4px_20px_-6px_rgba(124,58,237,0.45)] transition-colors hover:bg-violet-500"
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-lg"
        aria-hidden="true"
      >
        {game.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-200">
          Play again
        </p>
        <p className="truncate font-heading text-sm font-bold text-white">{game.title}</p>
        <p className="truncate text-xs text-violet-100">{game.description}</p>
      </div>
      <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-violet-600">
        Play
      </span>
    </Link>
  );
}
