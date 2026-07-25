"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { FlashcardDeckCard } from "@/lib/flashcards/types";
import { TopicListenButton } from "@/components/learn/topic-listen-button";
import { latinRomanised } from "@/lib/conjugation/romanised";
import {
  shuffleInPlace,
  stripTrailingRomanisation,
} from "@/lib/free-lessons/topic-game-utils";

type TopicSentenceBuilderProps = {
  lessonId: string;
  topicTitle: string;
  cards: FlashcardDeckCard[];
};

type PhraseTile = {
  id: string;
  word: string;
  romanised: string;
  bankIndex: number;
};

function tokens(text: string): string[] {
  return text
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function cardPhrase(card: FlashcardDeckCard) {
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

function buildBank(card: FlashcardDeckCard, allCards: FlashcardDeckCard[], key: string) {
  const phrase = cardPhrase(card);
  const correctSet = new Set(phrase.parts.map((part) => part.gurmukhi));
  const decoys: Array<{ gurmukhi: string; romanised: string }> = [];
  for (const other of shuffleInPlace(allCards.filter((item) => item.id !== card.id))) {
    for (const part of cardPhrase(other).parts) {
      if (!correctSet.has(part.gurmukhi)) decoys.push(part);
    }
  }
  const decoyCount = Math.min(phrase.parts.length >= 4 ? 2 : 1, decoys.length);
  const picked = shuffleInPlace(decoys).slice(0, decoyCount);
  const entries = [
    ...phrase.parts.map((part) => ({
      word: part.gurmukhi,
      romanised: part.romanised,
    })),
    ...picked.map((part) => ({
      word: part.gurmukhi,
      romanised: part.romanised,
    })),
  ];
  const bank = shuffleInPlace(entries).map((entry, index) => ({
    id: `${key}-${entry.word}-${index}`,
    word: entry.word,
    romanised: entry.romanised,
    bankIndex: index,
  }));
  return {
    target: phrase.parts.map((part) => part.gurmukhi),
    bank,
    phraseRomanised: phrase.romanised,
  };
}

export function TopicSentenceBuilder({
  lessonId,
  topicTitle,
  cards,
}: TopicSentenceBuilderProps) {
  const router = useRouter();
  const pool = useMemo(
    () => cards.filter((card) => cardPhrase(card).parts.length >= 2),
    [cards]
  );
  const [index, setIndex] = useState(0);
  const first = pool[0] ? buildBank(pool[0], cards, `${pool[0].id}-0`) : null;
  const [built, setBuilt] = useState<PhraseTile[]>([]);
  const [bank, setBank] = useState<PhraseTile[]>(() => first?.bank ?? []);
  const [target, setTarget] = useState<string[]>(() => first?.target ?? []);
  const [phraseRomanised, setPhraseRomanised] = useState(
    () => first?.phraseRomanised ?? ""
  );
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  if (pool.length === 0) {
    return (
      <p className="text-center text-sm text-zinc-500">
        Sentence building needs multi-word phrases for this topic — coming soon.
      </p>
    );
  }

  const card = pool[index];
  const finished = index >= pool.length;

  function resetFor(cardIndex: number) {
    const next = pool[cardIndex];
    if (!next) return;
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
    setScore((prev) => ({
      correct: prev.correct + (ok ? 1 : 0),
      total: prev.total + 1,
    }));
  }

  function next() {
    const nextIndex = index + 1;
    if (nextIndex >= pool.length) {
      setIndex(nextIndex);
      return;
    }
    setIndex(nextIndex);
    resetFor(nextIndex);
  }

  if (finished) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="font-heading text-2xl font-semibold text-zinc-900">
          Nice building
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          You got {score.correct} of {score.total} phrases.
        </p>
        <button
          type="button"
          onClick={() => router.push(`/dashboard/learn/free/${lessonId}`)}
          className="mt-8 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500"
        >
          Back to topic
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5 text-center">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Sentence Building
        </p>
        <h1 className="mt-1 font-heading text-xl font-semibold text-zinc-900">
          {topicTitle}
        </h1>
        <p className="mt-1 text-xs text-zinc-400">
          {index + 1} of {pool.length}
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
            <p className="text-sm font-semibold text-emerald-600">Correct!</p>
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
          onClick={next}
          className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
        >
          Continue
        </button>
      )}
    </div>
  );
}
