"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { GenderedNoun } from "@/lib/games/types";
import { shuffleArray } from "@/lib/flashcards/utils";
import { saveGameScore } from "@/lib/games/game-scores";

const WORD_COUNT = 20;
const BASE_POINTS = 10;
const SPEED_BONUS_MS = 3000;

type GenderSortModeProps = {
  nouns: GenderedNoun[];
  initialBestScore: number;
};

export function GenderSortMode({ nouns, initialBestScore }: GenderSortModeProps) {
  const backHref = `/dashboard/games/gender-sort`;

  const [phase, setPhase] = useState<"ready" | "playing" | "finished">("ready");
  const [queue, setQueue] = useState<GenderedNoun[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [shownAt, setShownAt] = useState<number>(Date.now());
  const [result, setResult] = useState<{ isNewBest: boolean; currentBest: number } | null>(
    null
  );

  const userIdRef = useRef<string | null>(null);
  const savedRef = useRef(false);

  const current = queue[index];

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      userIdRef.current = user?.id ?? null;
    });
  }, []);

  useEffect(() => {
    if (phase !== "finished" || savedRef.current) return;
    savedRef.current = true;

    const accuracy = queue.length > 0 ? Math.round((correct / queue.length) * 100) : 0;

    const persist = async () => {
      const userId = userIdRef.current;
      if (!userId) return;

      const supabase = createClient();
      const outcome = await saveGameScore(supabase, userId, "gender_sort", score, {
        accuracy,
        correct,
        total: queue.length,
      });
      setResult({ isNewBest: outcome.isNewBest, currentBest: outcome.currentBest });
    };

    void persist();
  }, [phase, score, correct, queue.length]);

  function startGame() {
    savedRef.current = false;
    const selected = shuffleArray(nouns).slice(0, Math.min(WORD_COUNT, nouns.length));
    setQueue(selected);
    setIndex(0);
    setScore(0);
    setCorrect(0);
    setShownAt(Date.now());
    setResult(null);
    setPhase("playing");
  }

  function finishGame(finalScore: number, finalCorrect: number) {
    setScore(finalScore);
    setCorrect(finalCorrect);
    setPhase("finished");
  }

  function handleSort(guess: "masculine" | "feminine") {
    if (phase !== "playing" || !current) return;

    const elapsed = Date.now() - shownAt;
    const isCorrect = guess === current.gender;
    const speedBonus = isCorrect && elapsed < SPEED_BONUS_MS ? 5 : 0;
    const points = isCorrect ? BASE_POINTS + speedBonus : 0;
    const nextScore = score + points;
    const nextCorrect = correct + (isCorrect ? 1 : 0);

    if (index + 1 >= queue.length) {
      finishGame(nextScore, nextCorrect);
      return;
    }

    setScore(nextScore);
    setCorrect(nextCorrect);
    setIndex((i) => i + 1);
    setShownAt(Date.now());
  }

  if (phase === "ready") {
    return (
      <div className="space-y-6">
        <div>
          <Link href={backHref} className="text-sm font-medium text-violet-600 hover:text-violet-500">
            ← Back to games
          </Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-violet-600">
            Gender Sort
          </p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900">Masculine or feminine?</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Sort {Math.min(WORD_COUNT, nouns.length)} nouns. Answer quickly for bonus points.
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Your best</p>
          <p className="mt-1 text-lg font-bold text-zinc-900">
            {initialBestScore > 0 ? `${initialBestScore} pts` : "No score yet"}
          </p>
        </div>
        <button
          type="button"
          onClick={startGame}
          disabled={nouns.length === 0}
          className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
        >
          Start sorting
        </button>
      </div>
    );
  }

  if (phase === "finished") {
    const accuracy = queue.length > 0 ? Math.round((correct / queue.length) * 100) : 0;
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-violet-600">Sorting complete</p>
          <h2 className="mt-2 text-2xl font-bold text-zinc-900">{score} points</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {correct} / {queue.length} correct ({accuracy}%)
          </p>
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
          Back to games
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
          {index + 1} / {queue.length} · {score} pts
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <p className="text-3xl font-bold text-zinc-900">{current?.punjabi_word}</p>
        <p className="mt-2 text-sm text-zinc-500">{current?.english_meaning}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => handleSort("masculine")}
          className="rounded-xl border-2 border-blue-200 bg-blue-50 px-4 py-6 text-sm font-bold text-blue-800 hover:bg-blue-100"
        >
          Masculine
        </button>
        <button
          type="button"
          onClick={() => handleSort("feminine")}
          className="rounded-xl border-2 border-pink-200 bg-pink-50 px-4 py-6 text-sm font-bold text-pink-800 hover:bg-pink-100"
        >
          Feminine
        </button>
      </div>
    </div>
  );
}
