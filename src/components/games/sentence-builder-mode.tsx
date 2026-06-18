"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { GrammarSentence } from "@/lib/games/types";
import { shuffleArray } from "@/lib/flashcards/utils";
import { saveGameScore } from "@/lib/games/game-scores";

const ROUNDS = 3;

type SentenceBuilderModeProps = {
  sentences: GrammarSentence[];
  initialBestScore: number;
};

export function SentenceBuilderMode({ sentences, initialBestScore }: SentenceBuilderModeProps) {
  const backHref = `/dashboard/games/sentence-builder`;

  const [phase, setPhase] = useState<"ready" | "playing" | "finished">("ready");
  const [rounds, setRounds] = useState<GrammarSentence[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [pool, setPool] = useState<string[]>([]);
  const [built, setBuilt] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [result, setResult] = useState<{ isNewBest: boolean; currentBest: number } | null>(
    null
  );

  const userIdRef = useRef<string | null>(null);
  const savedRef = useRef(false);

  const current = rounds[roundIndex];

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
      const outcome = await saveGameScore(supabase, userId, "sentence_builder", score, {
        rounds: ROUNDS,
      });
      setResult({ isNewBest: outcome.isNewBest, currentBest: outcome.currentBest });
    };

    void persist();
  }, [phase, score]);

  function loadRound(selected: GrammarSentence[], idx: number) {
    const sentence = selected[idx];
    if (!sentence) return;
    const tiles =
      sentence.word_tiles?.length > 0
        ? sentence.word_tiles
        : sentence.punjabi_sentence.trim().split(/\s+/);
    setPool(shuffleArray(tiles));
    setBuilt([]);
    setFeedback(null);
  }

  function startGame() {
    savedRef.current = false;
    const selected = shuffleArray(sentences).slice(0, ROUNDS);
    setRounds(selected);
    setRoundIndex(0);
    setScore(0);
    setResult(null);
    loadRound(selected, 0);
    setPhase("playing");
  }

  function advanceRound(nextScore: number) {
    if (roundIndex + 1 >= rounds.length) {
      setScore(nextScore);
      setPhase("finished");
      return;
    }
    const nextIndex = roundIndex + 1;
    setRoundIndex(nextIndex);
    setScore(nextScore);
    loadRound(rounds, nextIndex);
  }

  function handlePoolClick(word: string, idx: number) {
    if (feedback) return;
    setPool((prev) => prev.filter((_, i) => i !== idx));
    setBuilt((prev) => [...prev, word]);
  }

  function handleBuiltClick(word: string, idx: number) {
    if (feedback) return;
    setBuilt((prev) => prev.filter((_, i) => i !== idx));
    setPool((prev) => [...prev, word]);
  }

  function handleCheck() {
    if (!current || feedback) return;
    const attempt = built.join(" ");
    const correct = attempt === current.punjabi_sentence.trim();
    setFeedback(correct ? "correct" : "wrong");

    window.setTimeout(() => {
      advanceRound(score + (correct ? 1 : 0));
    }, 800);
  }

  if (phase === "ready") {
    return (
      <div className="space-y-6">
        <div>
          <Link href={backHref} className="text-sm font-medium text-violet-600 hover:text-violet-500">
            ← Back to games
          </Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-violet-600">
            Sentence Builder
          </p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900">Arrange the tiles</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Build {ROUNDS} Punjabi sentences from shuffled word tiles.
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Your best</p>
          <p className="mt-1 text-lg font-bold text-zinc-900">
            {initialBestScore > 0 ? `${initialBestScore} / ${ROUNDS}` : "No score yet"}
          </p>
        </div>
        <button
          type="button"
          onClick={startGame}
          disabled={sentences.length < ROUNDS}
          className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
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
          <p className="text-sm font-medium text-violet-600">Round complete</p>
          <h2 className="mt-2 text-2xl font-bold text-zinc-900">
            {score} / {ROUNDS}
          </h2>
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
          Round {roundIndex + 1} / {ROUNDS} · {score} correct
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Translate</p>
        <p className="mt-3 text-lg font-bold text-zinc-900">{current?.english_translation}</p>
      </div>

      <div
        className={`min-h-16 rounded-xl border-2 border-dashed p-3 ${
          feedback === "correct"
            ? "border-green-300 bg-green-50"
            : feedback === "wrong"
              ? "border-red-300 bg-red-50"
              : "border-violet-200 bg-violet-50/50"
        }`}
      >
        <div className="flex flex-wrap gap-2">
          {built.map((word, i) => (
            <button
              key={`built-${i}`}
              type="button"
              onClick={() => handleBuiltClick(word, i)}
              className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white"
            >
              {word}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {pool.map((word, i) => (
          <button
            key={`pool-${i}`}
            type="button"
            onClick={() => handlePoolClick(word, i)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:border-violet-300"
          >
            {word}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={handleCheck}
        disabled={built.length === 0 || Boolean(feedback)}
        className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
      >
        Check sentence
      </button>
    </div>
  );
}
