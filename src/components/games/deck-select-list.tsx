import { BackLink } from "@/components/navigation/back-link";
import Link from "next/link";
import type { GameDeckSummary } from "@/lib/games/load-game-decks";
import { gameDeckPlayHref } from "@/lib/games/catalog";

type DeckSelectListProps = {
  gameSlug: string;
  gameTitle: string;
  decks: GameDeckSummary[];
};

export function DeckSelectList({ gameSlug, gameTitle, decks }: DeckSelectListProps) {
  if (decks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
        <p className="text-lg font-semibold text-zinc-900">No decks available</p>
        <p className="mt-2 text-sm text-zinc-500">
          Unlock a course with flashcard sets to play {gameTitle}.
        </p>
        <BackLink
          fallbackHref="/dashboard/games"
          className="mt-4 inline-block text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          ← Back
        </BackLink>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {decks.map((deck) => (
        <Link
          key={`${deck.lessonId}-${deck.deckId}`}
          href={gameDeckPlayHref(gameSlug, deck.lessonId, deck.deckId)}
          className="block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-50/30"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            {deck.courseName}
          </p>
          <h3 className="mt-1 font-semibold text-zinc-900">{deck.setName}</h3>
          <p className="text-sm text-zinc-500">{deck.lessonTitle}</p>
          <p className="mt-2 text-xs font-medium text-zinc-400">
            {deck.cardCount} cards
          </p>
        </Link>
      ))}
    </div>
  );
}
