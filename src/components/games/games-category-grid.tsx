import type { GameCatalogEntry } from "@/lib/games/catalog";
import { GameGridTile } from "@/components/games/game-grid-tile";
import { GamesHorizontalRow } from "@/components/games/games-horizontal-row";

type GamesCategoryGridProps = {
  title: string;
  games: GameCatalogEntry[];
  personalBests: Record<string, number>;
};

export function GamesCategoryGrid({ title, games, personalBests }: GamesCategoryGridProps) {
  return (
    <GamesHorizontalRow title={title}>
      {games.map((game) => (
        <GameGridTile
          key={game.type}
          game={game}
          personalBest={personalBests[game.type] ?? null}
        />
      ))}
    </GamesHorizontalRow>
  );
}
