"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LevelTestQuestionBody } from "@/components/progression/level-test-question-body";
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
const ADVANCE_MS = 450;

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
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
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
  const locked = selectedOptionId !== null;

  function advanceAfterAnswer(isCorrect: boolean, optionId: string | null) {
    if (!question || locked || finished) return;

    setSelectedOptionId(optionId ?? "__answered__");
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
      setSelectedOptionId(null);
    }, ADVANCE_MS);
  }

  function handleSelectOption(optionId: string, isCorrect: boolean) {
    advanceAfterAnswer(isCorrect, optionId);
  }

  function handleSentenceBuilderAnswer(isCorrect: boolean) {
    advanceAfterAnswer(isCorrect, "__answered__");
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

      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {levelTestLabel(fromLevel)}
      </p>

      {question ? (
        <LevelTestQuestionBody
          key={question.id}
          question={question}
          locked={locked}
          selectedOptionId={selectedOptionId}
          onSelectOption={handleSelectOption}
          onSentenceBuilderAnswer={handleSentenceBuilderAnswer}
        />
      ) : null}
    </div>
  );
}
