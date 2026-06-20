"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { pickCycledPool } from "@/lib/games/session-settings";
import {
  LEVEL_TEST_PASS_PCT,
  LEVEL_TEST_QUESTION_COUNT,
  type LevelTestQuestion,
} from "@/lib/progression/level-tests";
import { levelTestLabel } from "@/lib/progression/tiers";
import { ui } from "@/lib/ui/styles";

type LevelTestPlayerProps = {
  fromLevel: number;
  questions: LevelTestQuestion[];
  mode: "placement" | "progression";
  backHref: string;
  onComplete: (result: {
    correctCount: number;
    totalCount: number;
    scorePct: number;
  }) => Promise<void>;
};

const LIGHT_SURFACE = "bg-white text-zinc-900 [color-scheme:light]";

export function LevelTestPlayer({
  fromLevel,
  questions,
  mode,
  backHref,
  onComplete,
}: LevelTestPlayerProps) {
  const sessionQuestions = useMemo(
    () => pickCycledPool(questions, Math.min(LEVEL_TEST_QUESTION_COUNT, questions.length)),
    [questions]
  );

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    scorePct: number;
    passed: boolean;
    correctCount: number;
    totalCount: number;
  } | null>(null);

  const question = sessionQuestions[index];
  const options = question
    ? [
        { key: "a", label: question.option_a },
        { key: "b", label: question.option_b },
        { key: "c", label: question.option_c },
        { key: "d", label: question.option_d },
      ]
    : [];
  const locked = selected !== null;

  async function handleAnswer(optionKey: string) {
    if (!question || locked || finished) return;

    setSelected(optionKey);
    const isCorrect = optionKey === question.correct_answer;
    const nextCorrect = correctCount + (isCorrect ? 1 : 0);

    window.setTimeout(async () => {
      if (index + 1 >= sessionQuestions.length) {
        const totalCount = sessionQuestions.length;
        const scorePct = Math.round((nextCorrect / totalCount) * 100);
        setCorrectCount(nextCorrect);
        setFinished(true);
        setSubmitting(true);
        setResult({
          scorePct,
          passed: scorePct >= LEVEL_TEST_PASS_PCT,
          correctCount: nextCorrect,
          totalCount,
        });
        await onComplete({
          correctCount: nextCorrect,
          totalCount,
          scorePct,
        });
        setSubmitting(false);
        return;
      }

      setCorrectCount(nextCorrect);
      setIndex((current) => current + 1);
      setSelected(null);
    }, 450);
  }

  if (questions.length === 0) {
    return (
      <div className={`${ui.card} ${LIGHT_SURFACE}`}>
        <p className="text-sm text-zinc-700">
          Questions for this test aren&apos;t available yet. Check back soon.
        </p>
        <Link href={backHref} className="mt-4 inline-block text-sm font-medium text-violet-600">
          ← Back
        </Link>
      </div>
    );
  }

  if (finished && result) {
    return (
      <div className={`${ui.card} ${LIGHT_SURFACE} space-y-4 text-center`}>
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">
          {mode === "placement" ? "Placement result" : levelTestLabel(fromLevel)}
        </p>
        <h2 className="text-3xl font-bold text-zinc-900">{result.scorePct}%</h2>
        <p className="text-sm text-zinc-700">
          {result.correctCount}/{result.totalCount} correct · need {LEVEL_TEST_PASS_PCT}%+
          to pass
        </p>
        {submitting ? (
          <p className="text-sm text-zinc-600">Saving…</p>
        ) : (
          <p
            className={`text-sm font-semibold ${result.passed ? "text-green-800" : "text-amber-800"}`}
          >
            {result.passed ? "Passed!" : "Not quite — you can try again anytime."}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-5 ${LIGHT_SURFACE}`}>
      <div className="flex items-center justify-between gap-3">
        <Link href={backHref} className="text-sm font-medium text-violet-700 hover:text-violet-600">
          ← Exit
        </Link>
        <p className="text-sm font-semibold text-zinc-900">
          {index + 1} / {sessionQuestions.length}
        </p>
      </div>

      <div className={`${ui.card} ${LIGHT_SURFACE}`}>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {levelTestLabel(fromLevel)}
        </p>
        <p className="mt-3 text-lg font-semibold leading-snug text-zinc-900">
          {question?.question_text}
        </p>
      </div>

      <div className="grid gap-2">
        {options.map((option) => {
          const isSelected = selected === option.key;
          const isCorrect = option.key === question?.correct_answer;
          const showResult = locked;

          let className =
            "w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ";

          if (!showResult) {
            className +=
              "border-zinc-300 bg-white text-zinc-900 shadow-sm hover:border-violet-400 hover:bg-violet-50";
          } else if (isCorrect) {
            className += "border-green-500 bg-green-50 text-green-900";
          } else if (isSelected) {
            className += "border-red-500 bg-red-50 text-red-900";
          } else {
            className += "border-zinc-200 bg-zinc-100 text-zinc-800";
          }

          return (
            <button
              key={option.key}
              type="button"
              aria-disabled={locked}
              onClick={() => void handleAnswer(option.key)}
              className={`${className}${locked ? " pointer-events-none" : ""}`}
            >
              <span className="font-semibold uppercase text-zinc-600">{option.key}.</span>{" "}
              <span className="text-zinc-900">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
