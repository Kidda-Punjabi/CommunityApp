"use client";

import { BackLink } from "@/components/navigation/back-link";
import Link from "next/link";
import { useState } from "react";
import type { GameDeckSummary } from "@/lib/games/load-game-decks";
import { gameDeckPlayHref } from "@/lib/games/catalog";
import {
  decksForWeek,
  groupDecksByWeek,
  sortedWeekNumbers,
} from "@/lib/games/game-deck-weeks";
import { ui } from "@/lib/ui/styles";

type DeckSelectListProps = {
  gameSlug: string;
  gameTitle: string;
  decks: GameDeckSummary[];
  /** When set, picking a deck calls this instead of navigating to the game. */
  onSelectDeck?: (deck: GameDeckSummary) => void;
  hideEmptyBackLink?: boolean;
};

export function DeckSelectList({
  gameSlug,
  gameTitle,
  decks,
  onSelectDeck,
  hideEmptyBackLink = false,
}: DeckSelectListProps) {
  const weeks = sortedWeekNumbers(decks);
  const [pickedWeek, setPickedWeek] = useState<number | null>(weeks[0] ?? null);
  const selectedWeek =
    pickedWeek != null && weeks.includes(pickedWeek) ? pickedWeek : (weeks[0] ?? null);
  const visibleDecks = selectedWeek == null ? decks : decksForWeek(decks, selectedWeek);
  const weekGroups = groupDecksByWeek(visibleDecks);

  if (decks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
        <p className="text-lg font-semibold text-zinc-900">No decks available</p>
        <p className="mt-2 text-sm text-zinc-500">
          Unlock a course with flashcard sets to play {gameTitle}.
        </p>
        {hideEmptyBackLink ? null : (
          <BackLink
            fallbackHref="/dashboard/games"
            className="mt-4 inline-block text-sm font-medium text-violet-600 hover:text-violet-500"
          >
            ← Back
          </BackLink>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {weeks.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Week</p>
          <div className="flex flex-wrap gap-2">
            {weeks.map((week) => (
              <button
                key={week}
                type="button"
                onClick={() => setPickedWeek(week)}
                className={selectedWeek === week ? ui.pillActive : ui.pillInactive}
              >
                Week {week}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {weekGroups.map((group) => (
        <section key={group.label} className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-700">{group.label}</h2>
          {group.decks.map((deck) => {
            const body = (
              <>
                <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
                  {deck.courseName}
                  {deck.weekNumber != null ? ` · Week ${deck.weekNumber}` : ""}
                </p>
                <h3 className="mt-1 font-semibold text-zinc-900">{deck.setName}</h3>
                <p className="text-sm text-zinc-500">{deck.lessonTitle}</p>
                <p className="mt-2 text-xs font-medium text-zinc-400">{deck.cardCount} cards</p>
              </>
            );
            const className =
              "block rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-50/30";

            if (onSelectDeck) {
              return (
                <button
                  key={`${deck.lessonId}-${deck.deckId}`}
                  type="button"
                  onClick={() => onSelectDeck(deck)}
                  className={`${className} w-full`}
                >
                  {body}
                </button>
              );
            }

            return (
              <Link
                key={`${deck.lessonId}-${deck.deckId}`}
                href={gameDeckPlayHref(gameSlug, deck.lessonId, deck.deckId)}
                className={className}
              >
                {body}
              </Link>
            );
          })}
        </section>
      ))}
    </div>
  );
}
