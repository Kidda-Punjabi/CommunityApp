"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { FlashcardDeckCard } from "@/lib/flashcards/types";
import type {
  GenderedNoun,
  VerbConjugation,
  ConjugationPrompt,
} from "@/lib/games/types";
import {
  CONJUGATION_PROMPTS,
  getConjugationForm,
} from "@/lib/games/types";
import { pickRandomItems, shuffleArray } from "@/lib/flashcards/utils";
import { saveGameScore } from "@/lib/games/game-scores";
import { buildGameAccuracyMetadata } from "@/lib/leaderboard/points";
import { notifyPointsEarned } from "@/lib/points/notify-points-earned";
import { PointsEarnedBadge } from "@/components/points/points-earned-badge";

export type StreakSurvivalSourceType = "deck" | "gender" | "verbs";

type StreakSurvivalModeProps = {
  sourceType: StreakSurvivalSourceType;
  deckName?: string;
  cards?: FlashcardDeckCard[];
  nouns?: GenderedNoun[];
  verbs?: VerbConjugation[];
  initialBestScore: number;
  backHref: string;
  metadataSource?: string;
};

type DeckQuestion = { kind: "deck"; prompt: string; answer: string; options: string[] };
type GenderQuestion = { kind: "gender"; prompt: string; answer: string; options: string[] };
type VerbQuestion = { kind: "verb"; prompt: string; answer: string; options: string[] };
type Question = DeckQuestion | GenderQuestion | VerbQuestion;

function buildDeckQuestion(cards: FlashcardDeckCard[]): DeckQuestion {
  const card = cards[Math.floor(Math.random() * cards.length)];
  const distractors = pickRandomItems(
    cards.map((c) => c.back_text),
    3,
    card.back_text
  );
  return {
    kind: "deck",
    prompt: card.front_text,
    answer: card.back_text,
    options: shuffleArray([card.back_text, ...distractors]),
  };
}

function buildGenderQuestion(nouns: GenderedNoun[]): GenderQuestion {
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const romanised = noun.romanised ? ` (${noun.romanised})` : "";
  return {
    kind: "gender",
    prompt: `${noun.punjabi_word}${romanised} — ${noun.english_meaning}`,
    answer: noun.gender,
    options: shuffleArray(["masculine", "feminine"]),
  };
}

function buildVerbQuestion(verbs: VerbConjugation[]): VerbQuestion | null {
  const verb = verbs[Math.floor(Math.random() * verbs.length)];
  const promptDef =
    CONJUGATION_PROMPTS[Math.floor(Math.random() * CONJUGATION_PROMPTS.length)];
  const answer = getConjugationForm(
    verb.conjugations,
    promptDef.tense,
    promptDef.number,
    promptDef.gender
  );
  if (!answer) return null;

  const pool: string[] = [];
  for (const p of CONJUGATION_PROMPTS as ConjugationPrompt[]) {
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
    kind: "verb",
    prompt: `${verb.verb_root} (${verb.verb_meaning}) — ${promptDef.label}`,
    answer,
    options: shuffleArray([answer, ...distractors]),
  };
}

export function StreakSurvivalMode({
  sourceType,
  deckName,
  cards = [],
  nouns = [],
  verbs = [],
  initialBestScore,
  backHref,
  metadataSource,
}: StreakSurvivalModeProps) {
  const [phase, setPhase] = useState<"ready" | "playing" | "finished">("ready");
  const [streak, setStreak] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [result, setResult] = useState<{
    isNewBest: boolean;
    currentBest: number;
    pointsEarned: number;
  } | null>(null);

  const userIdRef = useRef<string | null>(null);
  const savedRef = useRef(false);

  const title = useMemo(() => {
    if (sourceType === "deck") return deckName ?? "Deck";
    if (sourceType === "gender") return "Gendered nouns";
    return "Verb conjugations";
  }, [sourceType, deckName]);

  function nextQuestion(): Question | null {
    if (sourceType === "deck" && cards.length > 0) return buildDeckQuestion(cards);
    if (sourceType === "gender" && nouns.length > 0) return buildGenderQuestion(nouns);
    if (sourceType === "verbs" && verbs.length > 0) {
      for (let i = 0; i < 10; i++) {
        const q = buildVerbQuestion(verbs);
        if (q) return q;
      }
    }
    return null;
  }

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
      const total = streak + 1;
      const metadata: Record<string, unknown> = {
        source: metadataSource ?? sourceType,
        ...buildGameAccuracyMetadata(streak, total),
      };
      if (deckName) metadata.deck_name = deckName;

      const outcome = await saveGameScore(supabase, userId, "streak_survival", streak, metadata);
      setResult({
        isNewBest: outcome.isNewBest,
        currentBest: outcome.currentBest,
        pointsEarned: outcome.pointsEarned,
      });
      notifyPointsEarned(outcome.pointsEarned);
    };

    void persist();
  }, [phase, streak, sourceType, deckName]);

  function startGame() {
    savedRef.current = false;
    setStreak(0);
    setResult(null);
    setQuestion(nextQuestion());
    setPhase("playing");
  }

  function handleAnswer(answer: string) {
    if (phase !== "playing" || !question) return;

    if (answer === question.answer) {
      setStreak((s) => s + 1);
      setQuestion(nextQuestion());
      return;
    }

    setPhase("finished");
  }

  if (phase === "ready") {
    return (
      <div className="space-y-6">
        <div>
          <Link href={backHref} className="text-sm font-medium text-violet-600 hover:text-violet-500">
            ← Back
          </Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-violet-600">
            Streak Survival · {title}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900">How long can you survive?</h1>
          <p className="mt-2 text-sm text-zinc-500">One wrong answer ends the run.</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Your best</p>
          <p className="mt-1 text-lg font-bold text-zinc-900">
            {initialBestScore > 0 ? `${initialBestScore} streak` : "No score yet"}
          </p>
        </div>
        <button
          type="button"
          onClick={startGame}
          className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
        >
          Start survival
        </button>
      </div>
    );
  }

  if (phase === "finished") {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-red-600">Run ended</p>
          <h2 className="mt-2 text-2xl font-bold text-zinc-900">{streak} streak</h2>
          <PointsEarnedBadge points={result?.pointsEarned ?? 0} className="mt-3" />
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
          Try again
        </button>
        <Link href={backHref} className="block text-center text-sm font-medium text-violet-600 hover:text-violet-500">
          Back
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
        <p className="text-sm font-semibold text-violet-600">🔥 {streak} streak</p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <p className="text-lg font-bold text-zinc-900">{question?.prompt}</p>
      </div>

      <div className="grid gap-2">
        {question?.options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => handleAnswer(option)}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left text-sm font-medium capitalize text-zinc-900 hover:border-violet-300 hover:bg-violet-50"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
