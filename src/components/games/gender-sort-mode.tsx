"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { GenderedNoun } from "@/lib/games/types";
import { shuffleArray } from "@/lib/flashcards/utils";
import { GAMES_HUB_HREF } from "@/lib/games/catalog";
import { saveGameScore } from "@/lib/games/game-scores";

const WORD_COUNT = 20;
const BASE_POINTS = 10;
const SPEED_BONUS_MS = 3000;
const FEEDBACK_MS = 1100;

type GenderSortModeProps = {
  nouns: GenderedNoun[];
  initialBestScore: number;
};

type AnswerFeedback = {
  correct: boolean;
  chosen: "masculine" | "feminine";
  actual: "masculine" | "feminine";
  points: number;
};

function genderLabel(gender: "masculine" | "feminine") {
  return gender === "masculine" ? "Masculine" : "Feminine";
}

export function GenderSortMode({ nouns, initialBestScore }: GenderSortModeProps) {
  const gamesHubHref = GAMES_HUB_HREF;

  const [phase, setPhase] = useState<"ready" | "playing" | "finished">("ready");
  const [queue, setQueue] = useState<GenderedNoun[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [shownAt, setShownAt] = useState<number>(Date.now());
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [result, setResult] = useState<{ isNewBest: boolean; currentBest: number } | null>(
    null
  );

  const userIdRef = useRef<string | null>(null);
  const savedRef = useRef(false);
  const advanceTimerRef = useRef<number | null>(null);

  const current = queue[index];
  const locked = feedback !== null;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      userIdRef.current = user?.id ?? null;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current != null) {
        window.clearTimeout(advanceTimerRef.current);
      }
    };
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
    if (advanceTimerRef.current != null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    savedRef.current = false;
    const selected = shuffleArray(nouns).slice(0, Math.min(WORD_COUNT, nouns.length));
    setQueue(selected);
    setIndex(0);
    setScore(0);
    setCorrect(0);
    setShownAt(Date.now());
    setFeedback(null);
    setResult(null);
    setPhase("playing");
  }

  function finishGame(finalScore: number, finalCorrect: number) {
    setScore(finalScore);
    setCorrect(finalCorrect);
    setPhase("finished");
  }

  function handleSort(guess: "masculine" | "feminine") {
    if (phase !== "playing" || !current || locked) return;

    const elapsed = Date.now() - shownAt;
    const isCorrect = guess === current.gender;
    const speedBonus = isCorrect && elapsed < SPEED_BONUS_MS ? 5 : 0;
    const points = isCorrect ? BASE_POINTS + speedBonus : 0;
    const nextScore = score + points;
    const nextCorrect = correct + (isCorrect ? 1 : 0);

    setFeedback({
      correct: isCorrect,
      chosen: guess,
      actual: current.gender,
      points,
    });

    advanceTimerRef.current = window.setTimeout(() => {
      setFeedback(null);

      if (index + 1 >= queue.length) {
        finishGame(nextScore, nextCorrect);
        return;
      }

      setScore(nextScore);
      setCorrect(nextCorrect);
      setIndex((i) => i + 1);
      setShownAt(Date.now());
    }, FEEDBACK_MS);
  }

  if (phase === "ready") {
    return (
      <div className="space-y-6">
        <div>
          <Link href={gamesHubHref} className="text-sm font-medium text-violet-600 hover:text-violet-500">
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
        <Link href={gamesHubHref} className="block text-center text-sm font-medium text-violet-600 hover:text-violet-500">
          Back to games
        </Link>
      </div>
    );
  }

  const cardBorderClass = feedback
    ? feedback.correct
      ? "border-green-300 bg-green-50"
      : "border-red-300 bg-red-50"
    : "border-zinc-200 bg-white";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link href={gamesHubHref} className="text-sm font-medium text-violet-600 hover:text-violet-500">
          ← Exit
        </Link>
        <p className="text-sm font-semibold text-zinc-900">
          {index + 1} / {queue.length} · {score} pts
        </p>
      </div>

      <div className={`rounded-2xl border p-8 text-center shadow-sm transition-colors ${cardBorderClass}`}>
        <p className="text-3xl font-bold text-zinc-900">{current?.punjabi_word}</p>
        {current?.romanised && (
          <p className="mt-2 text-lg font-medium text-violet-600">{current.romanised}</p>
        )}
        <p className={`text-sm text-zinc-500 ${current?.romanised ? "mt-1" : "mt-2"}`}>
          {current?.english_meaning}
        </p>

        {feedback && (
          <div
            className={`mt-5 rounded-xl px-4 py-3 text-sm ${
              feedback.correct
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {feedback.correct ? (
              <>
                <p className="font-semibold">Correct!</p>
                {feedback.points > BASE_POINTS && (
                  <p className="mt-0.5">+{feedback.points} pts (speed bonus)</p>
                )}
                {feedback.points === BASE_POINTS && (
                  <p className="mt-0.5">+{feedback.points} pts</p>
                )}
              </>
            ) : (
              <>
                <p className="font-semibold">Not quite</p>
                <p className="mt-0.5">
                  You chose {genderLabel(feedback.chosen).toLowerCase()} — it&apos;s{" "}
                  <span className="font-semibold">{genderLabel(feedback.actual).toLowerCase()}</span>
                </p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => handleSort("masculine")}
          disabled={locked}
          className={`rounded-xl border-2 px-4 py-6 text-sm font-bold transition-opacity ${
            feedback?.chosen === "masculine" && feedback.correct
              ? "border-green-500 bg-green-100 text-green-900"
              : feedback?.chosen === "masculine" && !feedback.correct
                ? "border-red-500 bg-red-100 text-red-900"
                : "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100"
          } disabled:opacity-60`}
        >
          Masculine
        </button>
        <button
          type="button"
          onClick={() => handleSort("feminine")}
          disabled={locked}
          className={`rounded-xl border-2 px-4 py-6 text-sm font-bold transition-opacity ${
            feedback?.chosen === "feminine" && feedback.correct
              ? "border-green-500 bg-green-100 text-green-900"
              : feedback?.chosen === "feminine" && !feedback.correct
                ? "border-red-500 bg-red-100 text-red-900"
                : "border-pink-200 bg-pink-50 text-pink-800 hover:bg-pink-100"
          } disabled:opacity-60`}
        >
          Feminine
        </button>
      </div>
    </div>
  );
}
