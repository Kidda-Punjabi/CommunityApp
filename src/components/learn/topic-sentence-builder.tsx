"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { FlashcardDeckCard } from "@/lib/flashcards/types";

type TopicSentenceBuilderProps = {
  lessonId: string;
  topicTitle: string;
  cards: FlashcardDeckCard[];
};

function tokens(text: string): string[] {
  return text
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function TopicSentenceBuilder({
  lessonId,
  topicTitle,
  cards,
}: TopicSentenceBuilderProps) {
  const router = useRouter();
  const pool = useMemo(
    () => cards.filter((card) => tokens(card.back_text).length >= 2),
    [cards]
  );
  const [index, setIndex] = useState(0);
  const [built, setBuilt] = useState<string[]>([]);
  const [bank, setBank] = useState<string[]>(() =>
    pool[0] ? shuffle(tokens(pool[0].back_text)) : []
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
  const target = tokens(card.back_text);
  const finished = index >= pool.length;

  function resetFor(cardIndex: number) {
    const next = pool[cardIndex];
    setBuilt([]);
    setBank(next ? shuffle(tokens(next.back_text)) : []);
    setFeedback(null);
  }

  function pickTile(tile: string, tileIndex: number) {
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
    const ok = built.join(" ") === target.join(" ");
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
          className="mt-8 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-600"
        >
          Back to topic
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Sentence Building
      </p>
      <h1 className="mt-1 font-heading text-xl font-semibold text-zinc-900">
        {topicTitle}
      </h1>
      <p className="mt-1 text-xs text-zinc-400">
        {index + 1} of {pool.length}
      </p>

      <p className="mt-6 text-lg font-semibold text-zinc-900">{card.front_text}</p>
      <p className="mt-1 text-sm text-zinc-500">Tap the tiles in order</p>

      <div className="mt-5 min-h-16 rounded-2xl border border-dashed border-zinc-300 bg-white px-3 py-3">
        <div className="flex flex-wrap justify-center gap-2">
          {built.length === 0 ? (
            <span className="text-sm text-zinc-400">Your sentence…</span>
          ) : (
            built.map((tile, i) => (
              <span
                key={`${tile}-${i}`}
                className="rounded-xl bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900"
              >
                {tile}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {bank.map((tile, tileIndex) => (
          <button
            key={`${tile}-${tileIndex}`}
            type="button"
            onClick={() => pickTile(tile, tileIndex)}
            className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white"
          >
            {tile}
          </button>
        ))}
      </div>

      {feedback === "correct" ? (
        <p className="mt-4 text-sm font-semibold text-emerald-600">Correct!</p>
      ) : null}
      {feedback === "wrong" ? (
        <p className="mt-4 text-sm font-semibold text-rose-600">
          Not quite — try: {target.join(" ")}
        </p>
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
              className="flex-1 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Check
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={next}
            className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white"
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}
