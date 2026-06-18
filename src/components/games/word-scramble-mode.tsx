"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { FlashcardDeckContext } from "@/lib/flashcards/types";
import { shuffleArray } from "@/lib/flashcards/utils";
import { saveGameScoreIfBest } from "@/lib/games/game-scores";

type WordScrambleModeProps = {
  deck: FlashcardDeckContext;
  initialBestScore: number;
};

function scrambleWord(word: string): string[] {
  const chars = [...word];
  let scrambled = shuffleArray(chars);
  if (scrambled.join("") === word && chars.length > 1) {
    scrambled = shuffleArray(chars);
  }
  return scrambled;
}

export function WordScrambleMode({ deck, initialBestScore }: WordScrambleModeProps) {
  const backHref = `/dashboard/games/word-scramble`;

  const [phase, setPhase] = useState<"ready" | "playing" | "finished">("ready");
  const [queue, setQueue] = useState<typeof deck.cards>([]);
  const [index, setIndex] = useState(0);
  const [available, setAvailable] = useState<string[]>([]);
  const [built, setBuilt] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [result, setResult] = useState<{ isNewBest: boolean; currentBest: number } | null>(
    null
  );

  const userIdRef = useRef<string | null>(null);
  const savedRef = useRef(false);

  const currentCard = queue[index];

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      userIdRef.current = user?.id ?? null;
    });
  }, []);

  useEffect(() => {
    if (phase !== "finished" || savedRef.current) return;
    savedRef.current = true;

    const persist = async () => {
      const userId = userIdRef.current;
      if (!userId) return;

      const supabase = createClient();
      const outcome = await saveGameScoreIfBest(
        supabase,
        userId,
        "word_scramble",
        score,
        { deck_name: deck.deckName, time_seconds: elapsedSeconds },
        (next, prev, meta) => {
          const prevTime = (meta.time_seconds as number | undefined) ?? Infinity;
          return next > prev || (next === prev && elapsedSeconds < prevTime);
        }
      );
      setResult({ isNewBest: outcome.isNewBest, currentBest: outcome.currentBest });
    };

    void persist();
  }, [phase, score, deck.deckName, elapsedSeconds]);

  function loadRound(cards: typeof deck.cards, roundIndex: number) {
    const card = cards[roundIndex];
    if (!card) return;
    setAvailable(scrambleWord(card.front_text));
    setBuilt([]);
  }

  function startGame() {
    savedRef.current = false;
    const shuffled = shuffleArray(deck.cards);
    setQueue(shuffled);
    setIndex(0);
    setScore(0);
    setResult(null);
    setStartedAt(Date.now());
    setElapsedSeconds(0);
    loadRound(shuffled, 0);
    setPhase("playing");
  }

  function finishGame(finalScore: number) {
    const elapsed = startedAt
      ? Math.ceil((Date.now() - startedAt) / 1000)
      : 0;
    setElapsedSeconds(elapsed);
    setScore(finalScore);
    setPhase("finished");
  }

  function advanceRound(nextScore: number) {
    if (index + 1 >= queue.length) {
      finishGame(nextScore);
      return;
    }
    const nextIndex = index + 1;
    setIndex(nextIndex);
    loadRound(queue, nextIndex);
  }

  function handleLetterClick(letter: string, letterIndex: number) {
    setAvailable((prev) => prev.filter((_, i) => i !== letterIndex));
    setBuilt((prev) => [...prev, letter]);
  }

  function handleBuiltClick(letter: string, letterIndex: number) {
    setBuilt((prev) => prev.filter((_, i) => i !== letterIndex));
    setAvailable((prev) => [...prev, letter]);
  }

  function handleHint() {
    if (!currentCard || built.length > 0) return;
    const first = currentCard.front_text[0];
    if (!first) return;
    const idx = available.findIndex((c) => c === first);
    if (idx >= 0) handleLetterClick(first, idx);
  }

  function handleSubmit() {
    if (!currentCard) return;
    const attempt = built.join("");
    if (attempt === currentCard.front_text) {
      advanceRound(score + 1);
      return;
    }
    setBuilt([]);
    setAvailable(scrambleWord(currentCard.front_text));
  }

  if (phase === "ready") {
    return (
      <div className="space-y-6">
        <div>
          <Link href={backHref} className="text-sm font-medium text-violet-600 hover:text-violet-500">
            ← Back to decks
          </Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-violet-600">
            Word Scramble · {deck.deckName}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900">{deck.lessonTitle}</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Tap letters to rebuild each Punjabi word. Use hints if stuck.
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Your best</p>
          <p className="mt-1 text-lg font-bold text-zinc-900">
            {initialBestScore > 0 ? `${initialBestScore} words` : "No score yet"}
          </p>
        </div>
        <button
          type="button"
          onClick={startGame}
          className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
        >
          Start game
        </button>
      </div>
    );
  }

  if (phase === "finished") {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-violet-600">Complete!</p>
          <h2 className="mt-2 text-2xl font-bold text-zinc-900">
            {score} / {deck.cards.length} words
          </h2>
          <p className="mt-1 text-sm text-zinc-500">in {elapsedSeconds}s</p>
          {result?.isNewBest && (
            <p className="mt-3 text-sm font-semibold text-green-700">New personal best!</p>
          )}
          {result && !result.isNewBest && result.currentBest > 0 && (
            <p className="mt-3 text-sm text-zinc-500">Personal best: {result.currentBest}</p>
          )}
        </div>
        <button
          type="button"
          onClick={startGame}
          className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
        >
          Play again
        </button>
        <Link href={backHref} className="block text-center text-sm font-medium text-violet-600 hover:text-violet-500">
          Back to decks
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link href={backHref} className="text-sm font-medium text-violet-600 hover:text-violet-500">
          ← Exit
        </Link>
        <p className="text-sm font-semibold text-zinc-900">
          {index + 1} / {queue.length} · {score} correct
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Meaning</p>
        <p className="mt-3 text-xl font-bold text-zinc-900">{currentCard?.back_text}</p>
      </div>

      <div className="min-h-14 rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/50 p-3">
        <div className="flex flex-wrap gap-2">
          {built.map((letter, i) => (
            <button
              key={`built-${i}`}
              type="button"
              onClick={() => handleBuiltClick(letter, i)}
              className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-bold text-white"
            >
              {letter}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {available.map((letter, i) => (
          <button
            key={`avail-${i}-${letter}`}
            type="button"
            onClick={() => handleLetterClick(letter, i)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-bold text-zinc-900 hover:border-violet-300"
          >
            {letter}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleHint}
          className="flex-1 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          Hint
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={built.length === 0}
          className="flex-1 rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
        >
          Check
        </button>
      </div>
    </div>
  );
}
