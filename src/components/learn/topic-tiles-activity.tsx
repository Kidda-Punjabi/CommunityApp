"use client";

import { useMemo, useRef, useState } from "react";
import type { FlashcardDeckCard } from "@/lib/flashcards/types";
import { TopicListenButton } from "@/components/learn/topic-listen-button";
import {
  pickCards,
  shuffleInPlace,
  stripTrailingRomanisation,
} from "@/lib/free-lessons/topic-game-utils";

type TopicTilesActivityProps = {
  cards: FlashcardDeckCard[];
  itemCount: number;
  passThreshold: number;
  title: string;
  subtitle: string;
  encourageListen?: boolean;
  onComplete: (result: { percent: number; correct: number; total: number }) => void;
};

type PhraseTile = {
  id: string;
  gurmukhi: string;
  romanised: string;
};

function tokens(text: string): string[] {
  return text
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function cardPhrase(card: FlashcardDeckCard): {
  gurmukhi: string;
  romanised: string;
  parts: Array<{ gurmukhi: string; romanised: string }>;
} {
  const parsed = stripTrailingRomanisation(card.back_text);
  const romanised = card.romanised?.trim() || parsed.romanised || "";
  const gTokens = tokens(parsed.gurmukhi);
  const rTokens = tokens(romanised);
  const parts = gTokens.map((gurmukhi, index) => ({
    gurmukhi,
    romanised: rTokens.length === gTokens.length ? rTokens[index] : "",
  }));
  return { gurmukhi: parsed.gurmukhi, romanised, parts };
}

function buildBank(
  card: FlashcardDeckCard,
  allCards: FlashcardDeckCard[],
  roundKey: string
): { target: string[]; bank: PhraseTile[]; phraseRomanised: string } {
  const phrase = cardPhrase(card);
  const correct = phrase.parts;
  const correctSet = new Set(correct.map((part) => part.gurmukhi));

  const decoyCandidates: Array<{ gurmukhi: string; romanised: string }> = [];
  for (const other of shuffleInPlace(allCards.filter((item) => item.id !== card.id))) {
    for (const part of cardPhrase(other).parts) {
      if (!correctSet.has(part.gurmukhi)) {
        decoyCandidates.push(part);
      }
    }
  }

  const decoyCount = Math.min(
    correct.length >= 4 ? 2 : 1,
    decoyCandidates.length,
    Math.max(1, correct.length)
  );
  const decoys = shuffleInPlace(decoyCandidates).slice(0, decoyCount);

  const bank = shuffleInPlace([
    ...correct.map((part, index) => ({
      id: `${roundKey}-c-${index}-${part.gurmukhi}`,
      gurmukhi: part.gurmukhi,
      romanised: part.romanised,
    })),
    ...decoys.map((part, index) => ({
      id: `${roundKey}-d-${index}-${part.gurmukhi}`,
      gurmukhi: part.gurmukhi,
      romanised: part.romanised,
    })),
  ]);

  return {
    target: correct.map((part) => part.gurmukhi),
    bank,
    phraseRomanised: phrase.romanised,
  };
}

function TileChip({
  tile,
  onClick,
  muted,
}: {
  tile: PhraseTile;
  onClick?: () => void;
  muted?: boolean;
}) {
  const content = (
    <>
      <span className="block text-sm font-medium leading-snug">{tile.gurmukhi}</span>
      {tile.romanised ? (
        <span className="mt-0.5 block text-[11px] font-normal text-violet-600">
          {tile.romanised}
        </span>
      ) : null}
    </>
  );

  if (!onClick) {
    return (
      <span
        className={`rounded-xl px-3 py-1.5 text-left ${
          muted
            ? "bg-emerald-50 text-emerald-900"
            : "border border-zinc-200 bg-zinc-50 text-zinc-900"
        }`}
      >
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-left text-zinc-900 hover:bg-white"
    >
      {content}
    </button>
  );
}

export function TopicTilesActivity({
  cards,
  itemCount,
  passThreshold,
  title,
  subtitle,
  encourageListen = false,
  onComplete,
}: TopicTilesActivityProps) {
  const pool = useMemo(() => {
    const multi = cards.filter((card) => cardPhrase(card).parts.length >= 2);
    const source = multi.length >= 2 ? multi : cards;
    return pickCards(source, Math.min(itemCount, source.length));
  }, [cards, itemCount]);

  const initial = useMemo(
    () => (pool[0] ? buildBank(pool[0], cards, `${pool[0].id}-0`) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only seed first round
    [pool]
  );

  const [index, setIndex] = useState(0);
  const [built, setBuilt] = useState<PhraseTile[]>([]);
  const [bank, setBank] = useState<PhraseTile[]>(() => initial?.bank ?? []);
  const [target, setTarget] = useState<string[]>(() => initial?.target ?? []);
  const [phraseRomanised, setPhraseRomanised] = useState(
    () => initial?.phraseRomanised ?? ""
  );
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const correctCountRef = useRef(0);

  if (pool.length === 0) {
    return (
      <p className="text-center text-sm text-zinc-500">
        Sentence building needs phrases for this topic — coming soon.
      </p>
    );
  }

  const card = pool[index];

  function resetFor(cardIndex: number) {
    const next = pool[cardIndex];
    if (!next) {
      setBuilt([]);
      setBank([]);
      setTarget([]);
      setPhraseRomanised("");
      setFeedback(null);
      return;
    }
    const round = buildBank(next, cards, `${next.id}-${cardIndex}`);
    setBuilt([]);
    setBank(round.bank);
    setTarget(round.target);
    setPhraseRomanised(round.phraseRomanised);
    setFeedback(null);
  }

  function pickTile(tile: PhraseTile, tileIndex: number) {
    if (feedback) return;
    setBuilt((prev) => [...prev, tile]);
    setBank((prev) => prev.filter((_, i) => i !== tileIndex));
  }

  function undoTile() {
    if (feedback || built.length === 0) return;
    const last = built[built.length - 1];
    setBuilt((prev) => prev.slice(0, -1));
    setBank((prev) => [...prev, last]);
  }

  function check() {
    const ok = built.map((tile) => tile.gurmukhi).join(" ") === target.join(" ");
    setFeedback(ok ? "correct" : "wrong");
    if (ok) correctCountRef.current += 1;
  }

  function goNext() {
    const nextIndex = index + 1;
    if (nextIndex >= pool.length) {
      const total = pool.length;
      const correct = correctCountRef.current;
      const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
      onComplete({ percent, correct, total });
      return;
    }
    setIndex(nextIndex);
    resetFor(nextIndex);
  }

  return (
    <div className="mx-auto max-w-md text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Sentence tiles
      </p>
      <h1 className="mt-1 font-heading text-xl font-semibold text-zinc-900">{title}</h1>
      <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
      <p className="mt-2 text-xs text-zinc-400">
        {index + 1} of {pool.length} · Pass at {passThreshold}%
      </p>

      <div className="mt-6 flex items-start justify-center gap-2">
        <p className="text-lg font-semibold text-zinc-900">{card.front_text}</p>
        {card.audioUrl ? (
          <TopicListenButton
            audioUrl={card.audioUrl}
            label="Play pronunciation"
            className="mt-0.5"
          />
        ) : null}
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        Tap the tiles in order — extras are distractors. Use the romanisation under each tile if you don’t read Gurmukhi.
      </p>

      <div className="mt-5 min-h-16 rounded-2xl border border-dashed border-zinc-300 bg-white px-3 py-3">
        <div className="flex flex-wrap justify-center gap-2">
          {built.length === 0 ? (
            <span className="text-sm text-zinc-400">Your sentence…</span>
          ) : (
            built.map((tile) => (
              <TileChip key={`built-${tile.id}`} tile={tile} muted />
            ))
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {bank.map((tile, tileIndex) => (
          <TileChip
            key={tile.id}
            tile={tile}
            onClick={() => pickTile(tile, tileIndex)}
          />
        ))}
      </div>

      {feedback === "correct" ? (
        <p className="mt-4 text-sm font-semibold text-emerald-600">
          Correct!
          {encourageListen && card.audioUrl ? " Listen once, then continue." : ""}
        </p>
      ) : null}
      {feedback === "wrong" ? (
        <div className="mt-4 space-y-1">
          <p className="text-sm font-semibold text-rose-600">Not quite — try:</p>
          <p className="text-sm font-medium text-zinc-800">{target.join(" ")}</p>
          {phraseRomanised ? (
            <p className="text-sm text-violet-600">{phraseRomanised}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 flex gap-2">
        {!feedback ? (
          <>
            <button
              type="button"
              onClick={undoTile}
              className="flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700"
            >
              Undo
            </button>
            <button
              type="button"
              disabled={built.length === 0}
              onClick={check}
              className="flex-1 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Check
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={goNext}
            className="w-full rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white"
          >
            {index + 1 < pool.length ? "Continue" : "See results"}
          </button>
        )}
      </div>
    </div>
  );
}
