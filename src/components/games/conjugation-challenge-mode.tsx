"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { VerbConjugation } from "@/lib/games/types";
import {
  CONJUGATION_PROMPTS,
  getConjugationForm,
} from "@/lib/games/types";
import { pickRandomItems, shuffleArray } from "@/lib/flashcards/utils";
import { saveGameScore } from "@/lib/games/game-scores";

const ROUNDS = 10;

type Round = {
  verb: VerbConjugation;
  label: string;
  answer: string;
  options: string[];
};

function buildRound(verbs: VerbConjugation[]): Round | null {
  const verb = verbs[Math.floor(Math.random() * verbs.length)];
  const promptDef = CONJUGATION_PROMPTS[Math.floor(Math.random() * CONJUGATION_PROMPTS.length)];
  const answer = getConjugationForm(
    verb.conjugations,
    promptDef.tense,
    promptDef.number,
    promptDef.gender
  );
  if (!answer) return null;

  const pool: string[] = [];
  for (const p of CONJUGATION_PROMPTS) {
    const form = getConjugationForm(
      verb.conjugations,
      p.tense,
      p.number,
      p.gender
    );
    if (form && form !== answer) pool.push(form);
  }
  for (const other of verbs) {
    if (other.id === verb.id) continue;
    for (const p of CONJUGATION_PROMPTS) {
      const form = getConjugationForm(
        other.conjugations,
        p.tense,
        p.number,
        p.gender
      );
      if (form && form !== answer) pool.push(form);
    }
  }

  const distractors = pickRandomItems(pool, 3, answer);
  return {
    verb,
    label: promptDef.label,
    answer,
    options: shuffleArray([answer, ...distractors]),
  };
}

type ConjugationChallengeModeProps = {
  verbs: VerbConjugation[];
  initialBestScore: number;
};

export function ConjugationChallengeMode({
  verbs,
  initialBestScore,
}: ConjugationChallengeModeProps) {
  const backHref = `/dashboard/games/conjugation-challenge`;

  const [phase, setPhase] = useState<"ready" | "playing" | "finished">("ready");
  const [rounds, setRounds] = useState<Round[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [score, setScore] = useState(0);
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
      const outcome = await saveGameScore(
        supabase,
        userId,
        "conjugation_challenge",
        score,
        { rounds: ROUNDS }
      );
      setResult({ isNewBest: outcome.isNewBest, currentBest: outcome.currentBest });
    };

    void persist();
  }, [phase, score]);

  function generateRounds(): Round[] {
    const list: Round[] = [];
    for (let i = 0; i < ROUNDS * 3 && list.length < ROUNDS; i++) {
      const round = buildRound(verbs);
      if (round) list.push(round);
    }
    return list;
  }

  function startGame() {
    savedRef.current = false;
    setRounds(generateRounds());
    setRoundIndex(0);
    setScore(0);
    setResult(null);
    setPhase("playing");
  }

  function handleAnswer(answer: string) {
    if (phase !== "playing" || !current) return;

    const nextScore = score + (answer === current.answer ? 1 : 0);

    if (roundIndex + 1 >= rounds.length) {
      setScore(nextScore);
      setPhase("finished");
      return;
    }

    setScore(nextScore);
    setRoundIndex((i) => i + 1);
  }

  if (phase === "ready") {
    return (
      <div className="space-y-6">
        <div>
          <Link href={backHref} className="text-sm font-medium text-violet-600 hover:text-violet-500">
            ← Back to games
          </Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-violet-600">
            Conjugation Challenge
          </p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900">Pick the right form</h1>
          <p className="mt-2 text-sm text-zinc-500">{ROUNDS} multiple-choice rounds.</p>
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
          disabled={verbs.length === 0}
          className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
        >
          Start challenge
        </button>
      </div>
    );
  }

  if (phase === "finished") {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-violet-600">Challenge complete</p>
          <h2 className="mt-2 text-2xl font-bold text-zinc-900">
            {score} / {rounds.length}
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
          {roundIndex + 1} / {rounds.length} · {score} correct
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {current?.verb.verb_root} · {current?.label}
        </p>
        <p className="mt-2 text-sm text-zinc-500">{current?.verb.verb_meaning}</p>
      </div>

      <div className="grid gap-2">
        {current?.options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => handleAnswer(option)}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left text-sm font-medium text-zinc-900 hover:border-violet-300 hover:bg-violet-50"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
