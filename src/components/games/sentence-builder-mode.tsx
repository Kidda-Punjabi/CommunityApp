"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  defaultTenseSelectionForFocus,
  getTensesForFocus,
} from "@/lib/conjugation/challenge";
import {
  answersMatch,
  buildSentenceRound,
  buildTileBank,
  SENTENCE_BUILDER_ROUND_LENGTH,
  type SentenceBuilderQuestion,
  type SentenceNoun,
  type SentenceTile,
} from "@/lib/conjugation/sentence-builder";
import type { TenseGroup, TenseId, Verb } from "@/lib/conjugation/types";
import { TENSE_CATALOG } from "@/lib/conjugation/types";
import { GAMES_HUB_HREF } from "@/lib/games/catalog";
import { saveGameScore } from "@/lib/games/game-scores";
import { ui } from "@/lib/ui/styles";

const FEEDBACK_MS = 1200;

type Phase = "ready" | "playing" | "finished";
type Feedback = "correct" | "wrong";
type FocusArea = TenseGroup | "all";

const FOCUS_OPTIONS: { id: FocusArea; label: string }[] = [
  { id: "present", label: "Present" },
  { id: "past", label: "Past" },
  { id: "future", label: "Future" },
  { id: "all", label: "All" },
];

const GROUP_LABELS: Record<TenseGroup, string> = {
  present: "Present",
  past: "Past",
  future: "Future",
};

type SentenceBuilderModeProps = {
  verbs: Verb[];
  nouns: SentenceNoun[];
  verbsReady: boolean;
  nounsReady: boolean;
};

function TenseToggleGroup({
  group,
  selectedTenses,
  onToggle,
}: {
  group: TenseGroup;
  selectedTenses: Set<TenseId>;
  onToggle: (tenseId: TenseId) => void;
}) {
  const tenses = TENSE_CATALOG.filter((tense) => tense.group === group);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {GROUP_LABELS[group]}
      </p>
      <div className="flex flex-wrap gap-2">
        {tenses.map((tense) => {
          const active = selectedTenses.has(tense.id);
          return (
            <button
              key={tense.id}
              type="button"
              onClick={() => onToggle(tense.id)}
              className={active ? ui.pillActive : ui.pillInactive}
            >
              {tense.shortLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SentenceBuilderMode({
  verbs,
  nouns,
  verbsReady,
  nounsReady,
}: SentenceBuilderModeProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [focusArea, setFocusArea] = useState<FocusArea>("all");
  const [selectedTenses, setSelectedTenses] = useState<Set<TenseId>>(
    () => defaultTenseSelectionForFocus("all")
  );
  const [questions, setQuestions] = useState<SentenceBuilderQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [bank, setBank] = useState<SentenceTile[]>([]);
  const [built, setBuilt] = useState<SentenceTile[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const advanceTimerRef = useRef<number | null>(null);
  const userIdRef = useRef<string | null>(null);
  const savedRef = useRef(false);

  const current = questions[questionIndex];
  const score = results.filter(Boolean).length;
  const availableTenses = getTensesForFocus(focusArea, selectedTenses);
  const canStart = verbsReady && verbs.length > 0 && availableTenses.length > 0;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      userIdRef.current = user?.id ?? null;
    });
  }, []);

  useEffect(() => {
    if (phase !== "finished" || savedRef.current) return;
    savedRef.current = true;

    const total = questions.length;
    const correct = results.filter(Boolean).length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    const persist = async () => {
      const userId = userIdRef.current;
      if (!userId) return;

      const supabase = createClient();
      await saveGameScore(supabase, userId, "sentence_builder", correct, {
        accuracy,
        correct,
        total,
        rounds: total,
      });
    };

    void persist();
  }, [phase, questions.length, results]);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) {
        window.clearTimeout(advanceTimerRef.current);
      }
    };
  }, []);

  function handleFocusChange(nextFocus: FocusArea) {
    setFocusArea(nextFocus);
    setSelectedTenses(defaultTenseSelectionForFocus(nextFocus));
  }

  function toggleTense(tenseId: TenseId) {
    setSelectedTenses((prev) => {
      const next = new Set(prev);
      if (next.has(tenseId)) {
        next.delete(tenseId);
      } else {
        next.add(tenseId);
      }
      return next;
    });
  }

  function loadQuestion(question: SentenceBuilderQuestion) {
    setBank(buildTileBank(question, verbs, nouns));
    setBuilt([]);
    setFeedback(null);
  }

  function startRound() {
    savedRef.current = false;
    const round = buildSentenceRound(verbs, nouns, availableTenses);
    if (round.length === 0) return;

    setQuestions(round);
    setQuestionIndex(0);
    setResults([]);
    loadQuestion(round[0]);
    setPhase("playing");
  }

  function advanceRound(wasCorrect: boolean) {
    const nextResults = [...results, wasCorrect];

    if (questionIndex + 1 >= questions.length) {
      setResults(nextResults);
      setPhase("finished");
      return;
    }

    const nextIndex = questionIndex + 1;
    setResults(nextResults);
    setQuestionIndex(nextIndex);
    loadQuestion(questions[nextIndex]);
  }

  function moveToBuilt(tile: SentenceTile) {
    if (feedback) return;
    setBank((prev) => prev.filter((item) => item.id !== tile.id));
    setBuilt((prev) => [...prev, tile]);
  }

  function moveToBank(tile: SentenceTile) {
    if (feedback) return;
    setBuilt((prev) => prev.filter((item) => item.id !== tile.id));
    setBank((prev) => [...prev, tile]);
  }

  function handleCheck() {
    if (!current || feedback || built.length === 0) return;

    const attempt = built.map((tile) => tile.word);
    const isCorrect = answersMatch(attempt, current.correctTiles);
    setFeedback(isCorrect ? "correct" : "wrong");

    advanceTimerRef.current = window.setTimeout(() => {
      advanceRound(isCorrect);
    }, FEEDBACK_MS);
  }

  if (phase === "ready") {
    return (
      <div className="space-y-6">
        <div>
          <Link
            href={GAMES_HUB_HREF}
            className="text-sm font-medium text-violet-600 hover:text-violet-500"
          >
            ← Back to games
          </Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-violet-600">
            Sentence Builder
          </p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900">Form the sentence</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Tap word tiles in order to build {SENTENCE_BUILDER_ROUND_LENGTH} Punjabi sentences.
          </p>
        </div>

        {!verbsReady ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Run <code className="text-xs">supabase/verbs.sql</code> to enable this game.
          </div>
        ) : verbs.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No verbs found in the database yet.
          </div>
        ) : (
          <>
            {!nounsReady && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Object nouns unavailable — rounds will use subject + verb only.
              </div>
            )}

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Focus area
              </p>
              <div className="flex flex-wrap gap-2">
                {FOCUS_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleFocusChange(option.id)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      focusArea === option.id
                        ? "bg-violet-600 text-white"
                        : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-zinc-700">
                Sub-tenses{" "}
                <span className="font-normal text-zinc-500">(uncheck any to narrow the round)</span>
              </p>
              {focusArea === "all" ? (
                <div className="space-y-4">
                  {(["present", "past", "future"] as const).map((group) => (
                    <TenseToggleGroup
                      key={group}
                      group={group}
                      selectedTenses={selectedTenses}
                      onToggle={toggleTense}
                    />
                  ))}
                </div>
              ) : (
                <TenseToggleGroup
                  group={focusArea}
                  selectedTenses={selectedTenses}
                  onToggle={toggleTense}
                />
              )}
            </div>

            {availableTenses.length === 0 && (
              <p className="text-sm text-amber-700">Select at least one sub-tense to start.</p>
            )}

            <button
              type="button"
              onClick={startRound}
              disabled={!canStart}
              className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
            >
              Start
            </button>
          </>
        )}
      </div>
    );
  }

  if (phase === "finished") {
    const total = questions.length;
    const accuracy = total > 0 ? Math.round((score / total) * 100) : 0;

    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-violet-600">Round complete</p>
          <h2 className="mt-2 text-3xl font-bold text-zinc-900">
            {score}/{total}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">{accuracy}% accuracy</p>
        </div>
        <button
          type="button"
          onClick={() => setPhase("ready")}
          className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
        >
          Play again
        </button>
        <Link
          href={GAMES_HUB_HREF}
          className="block text-center text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          Back to games
        </Link>
      </div>
    );
  }

  const progress = ((questionIndex + 1) / questions.length) * 100;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={GAMES_HUB_HREF}
            className="text-sm font-medium text-violet-600 hover:text-violet-500"
          >
            ← Exit
          </Link>
          <p className="text-sm font-semibold text-zinc-900">
            {score} correct
          </p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-violet-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-zinc-500">
          Question {questionIndex + 1} of {questions.length}
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Form the sentence in Punjabi
        </p>
        <p className="mt-3 text-lg font-semibold text-zinc-900">{current?.englishPrompt}</p>
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
        <div className="flex min-h-10 flex-wrap gap-2">
          {built.map((tile) => (
            <button
              key={tile.id}
              type="button"
              onClick={() => moveToBank(tile)}
              disabled={Boolean(feedback)}
              className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-80"
            >
              {tile.word}
            </button>
          ))}
        </div>
      </div>

      {feedback && current?.romanised && (
        <p className="text-center text-sm text-violet-600">{current.romanised}</p>
      )}

      {feedback === "wrong" && current && (
        <p className="text-center text-sm text-zinc-600">
          Correct: <span className="font-medium text-zinc-900">{current.correctTiles.join(" ")}</span>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {bank.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={() => moveToBuilt(tile)}
            disabled={Boolean(feedback)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:border-violet-300 disabled:opacity-70"
          >
            {tile.word}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={handleCheck}
        disabled={built.length === 0 || Boolean(feedback)}
        className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
      >
        Check
      </button>
    </div>
  );
}
