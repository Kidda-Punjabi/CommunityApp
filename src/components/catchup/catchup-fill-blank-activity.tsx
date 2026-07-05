"use client";

import { useMemo, useState, useTransition } from "react";
import { awardCatchupActivityPointsAction } from "@/app/catchup/catchup-actions";
import { passedTypedAnswer, scoreTypedAnswer } from "@/lib/catchup/check-typed-answer";
import type { FillBlankQuestion } from "@/lib/catchup/load-segment-questions";
import { PointsEarnedBadge } from "@/components/points/points-earned-badge";
import { ui } from "@/lib/ui/styles";

type QuestionResult = {
  questionNumber: number;
  passed: boolean;
  similarity: number;
};

type CatchupFillBlankActivityProps = {
  segmentId: string;
  questions: FillBlankQuestion[];
  onComplete: () => void;
};

export function CatchupFillBlankActivity({
  segmentId,
  questions,
  onComplete,
}: CatchupFillBlankActivityProps) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [results, setResults] = useState<QuestionResult[] | null>(null);
  const [pointsEarned, setPointsEarned] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const scoreSummary = useMemo(() => {
    if (!results) return null;
    const correct = results.filter((result) => result.passed).length;
    return { correct, total: results.length };
  }, [results]);

  function handleSubmit() {
    const graded = questions.map((question) => {
      const input = answers[question.questionNumber]?.trim() ?? "";
      const similarity = scoreTypedAnswer(input, {
        romanised: question.blankAnswerRomanised,
        gurmukhi: question.blankAnswerGurmukhi,
      });
      return {
        questionNumber: question.questionNumber,
        passed: passedTypedAnswer(input, {
          romanised: question.blankAnswerRomanised,
          gurmukhi: question.blankAnswerGurmukhi,
        }),
        similarity,
      };
    });

    setResults(graded);
    setError(null);

    const correct = graded.filter((result) => result.passed).length;
    startTransition(async () => {
      const outcome = await awardCatchupActivityPointsAction(segmentId, correct, graded.length);
      if (outcome.error) {
        setError(outcome.error);
        return;
      }
      setPointsEarned(outcome.pointsEarned ?? 0);
    });
  }

  if (results && scoreSummary) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-violet-50 px-4 py-3">
          <p className="text-sm font-semibold text-violet-900">
            {scoreSummary.correct} of {scoreSummary.total} correct
          </p>
        </div>
        <ul className="space-y-2">
          {questions.map((question) => {
            const result = results.find((row) => row.questionNumber === question.questionNumber);
            const passed = result?.passed ?? false;
            return (
              <li
                key={question.id}
                className={`rounded-xl border px-3 py-2 text-sm ${
                  passed ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"
                }`}
              >
                <p className="font-medium text-zinc-900">
                  {question.promptEnglish ?? question.promptRomanised ?? question.promptGurmukhi}
                </p>
                <p className="mt-1 text-zinc-600">
                  Your answer: {answers[question.questionNumber] || "—"}
                  {passed ? " ✓" : ` (expected: ${question.blankAnswerRomanised})`}
                </p>
              </li>
            );
          })}
        </ul>
        {pointsEarned != null ? <PointsEarnedBadge points={pointsEarned} /> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button type="button" onClick={onComplete} className={ui.btnPrimary}>
          Continue
        </button>
      </div>
    );
  }

  const allAnswered = questions.every((question) => answers[question.questionNumber]?.trim());

  return (
    <div className="space-y-4">
      <ol className="space-y-4">
        {questions.map((question) => (
          <li key={question.id} className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
            <p className="text-sm font-medium text-zinc-900">
              {question.questionNumber}. {question.promptGurmukhi}
            </p>
            {question.promptRomanised ? (
              <p className="mt-1 text-sm text-zinc-500">{question.promptRomanised}</p>
            ) : null}
            {question.promptEnglish ? (
              <p className="mt-1 text-xs text-zinc-400">{question.promptEnglish}</p>
            ) : null}
            <input
              type="text"
              value={answers[question.questionNumber] ?? ""}
              onChange={(event) =>
                setAnswers((current) => ({
                  ...current,
                  [question.questionNumber]: event.target.value,
                }))
              }
              placeholder="Type the missing piece (romanised)"
              className="mt-3 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </li>
        ))}
      </ol>
      <button
        type="button"
        disabled={!allAnswered || pending}
        onClick={handleSubmit}
        className={ui.btnPrimary}
      >
        {pending ? "Checking…" : "Check answers"}
      </button>
    </div>
  );
}
