import type { GameCatalogEntry } from "@/lib/games/catalog";
import { GameGridTile } from "@/components/games/game-grid-tile";
import { GamesHorizontalRow } from "@/components/games/games-horizontal-row";
import { isGameUnlockedForTier } from "@/lib/games/premium-gating";
import type { ReactNode } from "react";

type GamesCategoryGridProps = {
  title: string;
  games: GameCatalogEntry[];
  personalBests: Record<string, number>;
  isPremium?: boolean;
  hasFoundationalAccess?: boolean;
  extraTiles?: ReactNode;
};

export function GamesCategoryGrid({
  title,
  games,
  personalBests,
  isPremium = false,
  hasFoundationalAccess = false,
  extraTiles = null,
}: GamesCategoryGridProps) {
  return (
    <GamesHorizontalRow title={title}>
      {games.map((game) => (
        <GameGridTile
          key={game.type}
          game={game}
          personalBest={personalBests[game.type] ?? null}
          locked={!isGameUnlockedForTier(game.type, isPremium, hasFoundationalAccess)}
        />
      ))}
      {extraTiles}
    </GamesHorizontalRow>
  );
}
