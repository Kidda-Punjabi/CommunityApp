import { ListRow } from "@/components/ui/list-row";
import type { GameCatalogEntry } from "@/lib/games/catalog";

type GameCardProps = {
  game: GameCatalogEntry;
  personalBest: number | null;
};

export function GameCard({ game, personalBest }: GameCardProps) {
  const subtitle =
    personalBest != null && personalBest > 0
      ? `Best score: ${personalBest}`
      : game.description;

  return (
    <ListRow
      href={game.href}
      emoji={game.emoji}
      title={game.title}
      subtitle={subtitle}
    />
  );
}
