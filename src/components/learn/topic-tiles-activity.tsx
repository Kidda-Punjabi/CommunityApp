"use client";

import { useMemo, useRef, useState } from "react";
import type { FlashcardDeckCard } from "@/lib/flashcards/types";
import { TopicListenButton } from "@/components/learn/topic-listen-button";
import { latinRomanised } from "@/lib/conjugation/romanised";
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
  word: string;
  romanised: string;
  /** Original shuffled bank index — restored when the tile is returned. */
  bankIndex: number;
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

  const entries = [
    ...correct.map((part) => ({
      word: part.gurmukhi,
      romanised: part.romanised,
    })),
    ...decoys.map((part) => ({
      word: part.gurmukhi,
      romanised: part.romanised,
    })),
  ];

  const bank = shuffleInPlace(entries).map((entry, index) => ({
    id: `${roundKey}-${entry.word}-${index}`,
    word: entry.word,
    romanised: entry.romanised,
    bankIndex: index,
  }));

  return {
    target: correct.map((part) => part.gurmukhi),
    bank,
    phraseRomanised: phrase.romanised,
  };
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

  function moveToBuilt(tile: PhraseTile) {
    if (feedback) return;
    setBank((prev) => prev.filter((item) => item.id !== tile.id));
    setBuilt((prev) => [...prev, tile]);
  }

  function moveToBank(tile: PhraseTile) {
    if (feedback) return;
    setBuilt((prev) => prev.filter((item) => item.id !== tile.id));
    setBank((prev) =>
      [...prev, tile].sort((a, b) => a.bankIndex - b.bankIndex)
    );
  }

  function check() {
    if (feedback || built.length === 0) return;
    const ok = built.map((tile) => tile.word).join(" ") === target.join(" ");
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
    <div className="mx-auto max-w-md space-y-5 text-center">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Sentence tiles
        </p>
        <h1 className="mt-1 font-heading text-xl font-semibold text-zinc-900">
          {title}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
        <p className="mt-2 text-xs text-zinc-400">
          {index + 1} of {pool.length} · Pass at {passThreshold}%
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Form the sentence in Punjabi
        </p>
        <div className="mt-3 flex items-start justify-center gap-2">
          <p className="text-lg font-semibold text-zinc-900">{card.front_text}</p>
          {card.audioUrl ? (
            <TopicListenButton
              audioUrl={card.audioUrl}
              label="Play pronunciation"
              className="mt-0.5"
            />
          ) : null}
        </div>
      </div>

      <div
        className={`min-h-20 rounded-xl border-2 border-dashed p-3 transition-colors ${
          feedback === "correct"
            ? "border-green-300 bg-green-50"
            : feedback === "wrong"
              ? "border-red-300 bg-red-50"
              : "border-violet-200 bg-violet-50/50"
        }`}
      >
        <div className="flex min-h-10 flex-wrap justify-center gap-2">
          {built.length === 0 ? (
            <span className="self-center text-sm text-zinc-400">
              Tap tiles below to build…
            </span>
          ) : (
            built.map((tile) => (
              <button
                key={`built-${tile.id}`}
                type="button"
                onClick={() => moveToBank(tile)}
                disabled={Boolean(feedback)}
                className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-80"
              >
                <span>{tile.word}</span>
                {latinRomanised(tile.romanised) ? (
                  <span className="mt-0.5 block text-xs font-normal text-violet-200">
                    {latinRomanised(tile.romanised)}
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </div>

      {feedback ? (
        <div className="space-y-1">
          {feedback === "correct" ? (
            <p className="text-sm font-semibold text-emerald-600">
              Correct!
              {encourageListen && card.audioUrl
                ? " Listen once, then continue."
                : ""}
            </p>
          ) : (
            <p className="text-sm font-semibold text-rose-600">Not quite — try:</p>
          )}
          <p className="text-sm font-medium text-zinc-900">{target.join(" ")}</p>
          {latinRomanised(phraseRomanised) ? (
            <p className="text-sm text-violet-600">
              {latinRomanised(phraseRomanised)}
            </p>
          ) : phraseRomanised ? (
            <p className="text-sm text-violet-600">{phraseRomanised}</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap justify-center gap-2">
        {bank.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={() => moveToBuilt(tile)}
            disabled={Boolean(feedback)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:border-violet-300 disabled:opacity-70"
          >
            <span>{tile.word}</span>
            {latinRomanised(tile.romanised) ? (
              <span className="mt-0.5 block text-xs font-normal text-violet-600">
                {latinRomanised(tile.romanised)}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {!feedback ? (
        <button
          type="button"
          onClick={check}
          disabled={built.length === 0}
          className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
        >
          Check
        </button>
      ) : (
        <button
          type="button"
          onClick={goNext}
          className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
        >
          {index + 1 < pool.length ? "Continue" : "See results"}
        </button>
      )}
    </div>
  );
}
