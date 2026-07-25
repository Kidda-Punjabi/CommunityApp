"use client";

import { useMemo, useState } from "react";
import type { FlashcardDeckCard } from "@/lib/flashcards/types";
import { PunjabiWithRomanisation } from "@/components/learn/punjabi-with-romanisation";
import {
  cardPunjabiDisplay,
  pickCards,
  shuffleInPlace,
} from "@/lib/free-lessons/topic-game-utils";

type TopicMatchActivityProps = {
  cards: FlashcardDeckCard[];
  itemCount: number;
  passThreshold: number;
  title: string;
  subtitle: string;
  onComplete: (result: { percent: number; correct: number; total: number }) => void;
};

type Tile = {
  id: string;
  cardId: string;
  text: string;
  romanised: string | null;
  side: "en" | "pa";
};

export function TopicMatchActivity({
  cards,
  itemCount,
  passThreshold,
  title,
  subtitle,
  onComplete,
}: TopicMatchActivityProps) {
  const roundCards = useMemo(
    () => pickCards(cards, Math.max(3, Math.min(itemCount, cards.length))),
    [cards, itemCount]
  );

  const [tiles, setTiles] = useState<Tile[]>(() => buildTiles(roundCards));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(() => new Set());
  const [wrongId, setWrongId] = useState<string | null>(null);
  const [pairs, setPairs] = useState(0);

  const total = roundCards.length;
  const done = matched.size >= total;

  function buildTiles(list: FlashcardDeckCard[]): Tile[] {
    const next: Tile[] = [];
    for (const card of list) {
      const { gurmukhi, romanised } = cardPunjabiDisplay(card);
      next.push({
        id: `${card.id}-en`,
        cardId: card.id,
        text: card.front_text,
        romanised: null,
        side: "en",
      });
      next.push({
        id: `${card.id}-pa`,
        cardId: card.id,
        text: gurmukhi,
        romanised: romanised || null,
        side: "pa",
      });
    }
    return shuffleInPlace(next);
  }

  function selectTile(tile: Tile) {
    if (done || matched.has(tile.cardId) || wrongId) return;

    if (!selectedId) {
      setSelectedId(tile.id);
      return;
    }

    if (selectedId === tile.id) {
      setSelectedId(null);
      return;
    }

    const first = tiles.find((t) => t.id === selectedId);
    if (!first) {
      setSelectedId(tile.id);
      return;
    }

    if (first.cardId === tile.cardId && first.side !== tile.side) {
      const nextMatched = new Set(matched).add(tile.cardId);
      const nextPairs = pairs + 1;
      setMatched(nextMatched);
      setPairs(nextPairs);
      setSelectedId(null);
      if (nextMatched.size >= total) {
        const percent = total === 0 ? 0 : Math.round((nextPairs / total) * 100);
        onComplete({ percent, correct: nextPairs, total });
      }
      return;
    }

    setWrongId(tile.id);
    window.setTimeout(() => {
      setWrongId(null);
      setSelectedId(null);
    }, 450);
  }

  if (roundCards.length < 2) {
    return (
      <p className="text-center text-sm text-zinc-500">
        Need at least two words in this topic to play Match.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-md text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Match</p>
      <h1 className="mt-1 font-heading text-xl font-semibold text-zinc-900">{title}</h1>
      <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
      <p className="mt-2 text-xs text-zinc-400">
        {pairs} of {total} pairs · Pass at {passThreshold}%
      </p>

      <ul className="mt-5 grid grid-cols-2 gap-2">
        {tiles.map((tile) => {
          const isMatched = matched.has(tile.cardId);
          const isSelected = selectedId === tile.id;
          const isWrong = wrongId === tile.id;
          let style = "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300";
          if (isMatched) style = "border-emerald-300 bg-emerald-50 text-emerald-800 opacity-70";
          else if (isWrong) style = "border-rose-300 bg-rose-50 text-rose-800";
          else if (isSelected) style = "border-violet-400 bg-violet-50 text-violet-900";

          return (
            <li key={tile.id}>
              <button
                type="button"
                disabled={isMatched || done}
                onClick={() => selectTile(tile)}
                className={`min-h-16 w-full rounded-2xl border px-3 py-3 text-sm font-medium transition disabled:cursor-default ${style}`}
              >
                {tile.side === "pa" ? (
                  <PunjabiWithRomanisation
                    gurmukhi={tile.text}
                    romanised={tile.romanised}
                  />
                ) : (
                  tile.text
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
