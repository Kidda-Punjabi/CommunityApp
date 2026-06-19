"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  buildChallengeRound,
  CHALLENGE_ROUND_LENGTH,
  computeGroupBreakdown,
  defaultTenseSelectionForFocus,
  getTensesForFocus,
  type ChallengeQuestion,
} from "@/lib/conjugation/challenge";
import type { TenseGroup, TenseId, Verb } from "@/lib/conjugation/types";
import { TENSE_CATALOG } from "@/lib/conjugation/types";
import { GAMES_HUB_HREF } from "@/lib/games/catalog";
import { saveGameScore } from "@/lib/games/game-scores";
import { notifyPointsEarned } from "@/lib/points/notify-points-earned";
import { PointsEarnedBadge } from "@/components/points/points-earned-badge";
import { ui } from "@/lib/ui/styles";

const FEEDBACK_MS = 1000;

type FocusArea = TenseGroup | "all";
type Phase = "setup" | "playing" | "finished";

type AnswerFeedback = {
  selected: string;
  isCorrect: boolean;
};

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

type ConjugationChallengeModeProps = {
  verbs: Verb[];
  tableReady: boolean;
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

function QuestionPrompt({ question }: { question: ChallengeQuestion }) {
  if (question.format === "A") {
    return (
      <div className="space-y-2 text-center">
        <p className="text-2xl font-semibold text-zinc-900">
          {question.verbRoot}
          <span className="text-zinc-400">…</span>
        </p>
        <p className="text-sm text-zinc-500">{question.english}</p>
        <p className="text-sm font-medium text-violet-700">{question.tenseLabel}</p>
        <p className="text-lg text-zinc-800">{question.pronounDisplay}</p>
        <p className="text-xs text-zinc-400">Pick the correct verb form</p>
      </div>
    );
  }

  if (question.format === "B") {
    return (
      <div className="space-y-2 text-center">
        <p className="text-2xl font-semibold text-zinc-900">{question.gapSentence}</p>
        <p className="text-sm text-zinc-500">{question.englishGloss}</p>
        <p className="text-xs text-zinc-400">Fill the gap</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-center">
      <p className="text-xl font-semibold text-zinc-900">{question.englishGloss}</p>
      <p className="text-sm font-medium text-violet-700">({question.tenseLabel})</p>
      <p className="text-xs text-zinc-400">Pick the correct Punjabi sentence</p>
    </div>
  );
}

export function ConjugationChallengeMode({ verbs, tableReady }: ConjugationChallengeModeProps) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [focusArea, setFocusArea] = useState<FocusArea>("all");
  const [selectedTenses, setSelectedTenses] = useState<Set<TenseId>>(
    () => defaultTenseSelectionForFocus("all")
  );
  const [questions, setQuestions] = useState<ChallengeQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [pointsEarned, setPointsEarned] = useState(0);

  const advanceTimerRef = useRef<number | null>(null);
  const userIdRef = useRef<string | null>(null);
  const savedRef = useRef(false);

  const current = questions[questionIndex];
  const score = results.filter(Boolean).length;

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
      const outcome = await saveGameScore(supabase, userId, "conjugation_challenge", correct, {
        accuracy,
        correct,
        total,
        rounds: total,
      });
      setPointsEarned(outcome.pointsEarned);
      notifyPointsEarned(outcome.pointsEarned);
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

  function startRound() {
    savedRef.current = false;
    const availableTenses = getTensesForFocus(focusArea, selectedTenses);
    let round: ChallengeQuestion[] = [];

    for (let attempt = 0; attempt < 8 && round.length < CHALLENGE_ROUND_LENGTH; attempt += 1) {
      round = buildChallengeRound(verbs, availableTenses);
    }

    if (round.length === 0) return;

    setQuestions(round.slice(0, CHALLENGE_ROUND_LENGTH));
    setQuestionIndex(0);
    setResults([]);
    setFeedback(null);
    setPhase("playing");
  }

  function handleAnswer(answer: string) {
    if (phase !== "playing" || !current || feedback) return;

    const isCorrect = answer === current.correctAnswer;
    setFeedback({ selected: answer, isCorrect });

    advanceTimerRef.current = window.setTimeout(() => {
      const nextResults = [...results, isCorrect];

      if (questionIndex + 1 >= questions.length) {
        setResults(nextResults);
        setFeedback(null);
        setPhase("finished");
        return;
      }

      setResults(nextResults);
      setQuestionIndex((index) => index + 1);
      setFeedback(null);
    }, FEEDBACK_MS);
  }

  const availableTenses = getTensesForFocus(focusArea, selectedTenses);
  const canStart = tableReady && verbs.length > 0 && availableTenses.length > 0;

  if (phase === "setup") {
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
            Conjugation Challenge
          </p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900">Test your verb forms</h1>
          <p className="mt-2 text-sm text-zinc-500">
            {CHALLENGE_ROUND_LENGTH} multiple-choice questions — no typing required.
          </p>
        </div>

        {!tableReady ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Run <code className="text-xs">supabase/verbs.sql</code> to enable this game.
          </div>
        ) : verbs.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No verbs found in the database yet.
          </div>
        ) : (
          <>
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
    const breakdown = computeGroupBreakdown(questions, results);

    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-violet-600">Challenge complete</p>
          <h2 className="mt-2 text-3xl font-bold text-zinc-900">
            {score}/{total}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">{accuracy}% accuracy</p>
          <PointsEarnedBadge points={pointsEarned} className="mt-3" />

          <div className="mt-5 space-y-2 text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              By tense group
            </p>
            {(["present", "past", "future"] as const).map((group) => {
              const stats = breakdown[group];
              if (stats.total === 0) return null;
              return (
                <div
                  key={group}
                  className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-zinc-700">{GROUP_LABELS[group]}</span>
                  <span className="text-zinc-600">
                    {stats.correct}/{stats.total}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPhase("setup")}
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={GAMES_HUB_HREF}
          className="text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          ← Exit
        </Link>
        <p className="text-sm font-semibold text-zinc-900">
          {questionIndex + 1} / {questions.length} · {score} correct
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        {current && <QuestionPrompt question={current} />}
      </div>

      <div className="grid gap-2">
        {current?.options.map((option) => {
          const isSelected = feedback?.selected === option;
          const isCorrect = option === current.correctAnswer;
          const showResult = feedback !== null;

          let className =
            "flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ";

          if (showResult) {
            if (isCorrect) {
              className += "border-green-400 bg-green-50 text-green-900";
            } else if (isSelected) {
              className += "border-red-400 bg-red-50 text-red-900";
            } else {
              className += "border-zinc-200 bg-white text-zinc-600";
            }
          } else {
            className +=
              "border-zinc-200 bg-white text-zinc-900 hover:border-violet-300 hover:bg-violet-50";
          }

          return (
            <button
              key={option}
              type="button"
              disabled={Boolean(feedback)}
              onClick={() => handleAnswer(option)}
              className={className}
            >
              <span className={current.format === "C" ? "text-base" : "text-lg"}>{option}</span>
              {showResult && isCorrect && (
                <span className="ml-2 text-green-600" aria-hidden="true">
                  ✓
                </span>
              )}
              {showResult && isSelected && !isCorrect && (
                <span className="ml-2 text-red-600" aria-hidden="true">
                  ✗
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
