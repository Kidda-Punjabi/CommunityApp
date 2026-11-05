import type { GameCatalogEntry } from "@/lib/games/catalog";
import { GameGridTile } from "@/components/games/game-grid-tile";
import { isGameUnlockedForTier } from "@/lib/games/premium-gating";
import type { ReactNode } from "react";

export const GAMES_LIST_GRID_CLASS = "grid grid-cols-3 gap-x-2 gap-y-4 tab:grid-cols-4 lg:grid-cols-6";

type GamesCategoryGridProps = {
  games: GameCatalogEntry[];
  personalBests: Record<string, number>;
  isPremium?: boolean;
  hasFoundationalAccess?: boolean;
  extraTiles?: ReactNode;
};

export function GamesCategoryGrid({
  games,
  personalBests,
  isPremium = false,
  hasFoundationalAccess = false,
  extraTiles = null,
}: GamesCategoryGridProps) {
  return (
    <div className={GAMES_LIST_GRID_CLASS}>
      {games.map((game) => (
        <GameGridTile
          key={game.type}
          game={game}
          personalBest={personalBests[game.type] ?? null}
          locked={!isGameUnlockedForTier(game.type, isPremium, hasFoundationalAccess)}
        />
      ))}
      {extraTiles}
    </div>
  );
}
