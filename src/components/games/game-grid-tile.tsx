"use client";

import type { GameCatalogEntry } from "@/lib/games/catalog";
import { GAMES_TILE_WIDTH_CLASS } from "@/components/games/games-horizontal-row";
import { GameTileCornerBadge } from "@/components/games/game-tile-corner";
import { recordLastPlayedGame } from "@/lib/games/last-played";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";

type GameGridTileProps = {
  game: GameCatalogEntry;
  personalBest: number | null;
};

function scoreLabel(personalBest: number | null): string {
  if (personalBest != null && personalBest > 0) {
    return `Best: ${personalBest}`;
  }
  return "Not played yet";
}

export function GameGridTile({ game, personalBest }: GameGridTileProps) {
  return (
    <Link
      href={game.href}
      onClick={() => recordLastPlayedGame(game.type)}
      className={`${ui.cardBordered} ${GAMES_TILE_WIDTH_CLASS} group relative flex min-h-[9.25rem] flex-col p-4 transition-all hover:border-violet-200 hover:shadow-[0_6px_28px_-6px_rgba(124,58,237,0.12)]`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-xl"
          aria-hidden="true"
        >
          {game.emoji}
        </span>
        <GameTileCornerBadge personalBest={personalBest} />
      </div>
      <p className="mt-3 line-clamp-3 font-heading text-sm font-semibold leading-snug text-zinc-900">
        {game.title}
      </p>
      <p className="mt-auto pt-2 text-xs font-medium text-zinc-500">{scoreLabel(personalBest)}</p>
    </Link>
  );
}
