"use client";

import { useState } from "react";
import type { GameCatalogEntry } from "@/lib/games/catalog";
import { INITIAL_GRID_VISIBLE } from "@/lib/games/hub-config";
import { GameGridTile } from "@/components/games/game-grid-tile";
import { ui } from "@/lib/ui/styles";

type GamesCategoryGridProps = {
  title: string;
  games: GameCatalogEntry[];
  personalBests: Record<string, number>;
  categoryLabel: string;
};

export function GamesCategoryGrid({
  title,
  games,
  personalBests,
  categoryLabel,
}: GamesCategoryGridProps) {
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = Math.max(0, games.length - INITIAL_GRID_VISIBLE);
  const visibleGames = expanded ? games : games.slice(0, INITIAL_GRID_VISIBLE);

  return (
    <section>
      <h2 className={ui.sectionTitle}>{title}</h2>
      <div className="grid grid-cols-2 gap-3">
        {visibleGames.map((game) => (
          <GameGridTile
            key={game.type}
            game={game}
            personalBest={personalBests[game.type] ?? null}
          />
        ))}
      </div>
      {hiddenCount > 0 && !expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className={`mt-4 ${ui.btnSecondary} w-full justify-center`}
        >
          Show {hiddenCount} more {categoryLabel} games
        </button>
      ) : null}
    </section>
  );
}
