import Link from "next/link";
import type { GameCatalogEntry } from "@/lib/games/catalog";

type GameCardProps = {
  game: GameCatalogEntry;
  personalBest: number | null;
};

export function GameCard({ game, personalBest }: GameCardProps) {
  return (
    <Link
      href={game.href}
      className="block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-50/30"
    >
      <div className="flex items-start gap-3">
        <span className="text-3xl" role="img" aria-hidden="true">
          {game.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-zinc-900">{game.title}</h3>
          <p className="mt-1 text-sm text-zinc-500">{game.description}</p>
          <p className="mt-2 text-xs font-semibold text-violet-600">
            {personalBest != null && personalBest > 0
              ? `Best: ${personalBest}`
              : "No score yet"}
          </p>
        </div>
      </div>
    </Link>
  );
}
