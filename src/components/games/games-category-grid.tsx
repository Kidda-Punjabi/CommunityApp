import type { GameCatalogEntry } from "@/lib/games/catalog";
import { GameGridTile } from "@/components/games/game-grid-tile";
import { GamesHorizontalRow } from "@/components/games/games-horizontal-row";
import { isGameUnlockedForTier } from "@/lib/games/premium-gating";

type GamesCategoryGridProps = {
  title: string;
  games: GameCatalogEntry[];
  personalBests: Record<string, number>;
  isPremium?: boolean;
};

export function GamesCategoryGrid({
  title,
  games,
  personalBests,
  isPremium = false,
}: GamesCategoryGridProps) {
  return (
    <GamesHorizontalRow title={title}>
      {games.map((game) => (
        <GameGridTile
          key={game.type}
          game={game}
          personalBest={personalBests[game.type] ?? null}
          locked={!isGameUnlockedForTier(game.type, isPremium)}
        />
      ))}
    </GamesHorizontalRow>
  );
}
