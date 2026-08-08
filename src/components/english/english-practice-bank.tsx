"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EnglishBilingualToggle } from "@/components/english/english-bilingual-toggle";
import type { EnglishExamQuestion } from "@/lib/learning/english-exam-courses";
import { cn } from "@/lib/ui/styles";

type EnglishPracticeBankProps = {
  courseName: string;
  courseId: string;
  questions: EnglishExamQuestion[];
};

export function EnglishPracticeBank({
  courseName,
  courseId,
  questions,
}: EnglishPracticeBankProps) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [showEnglish, setShowEnglish] = useState(true);

  const question = questions[index];
  const total = questions.length;

  const optionLabels = useMemo(() => {
    if (!question) return [];
    return [
      { key: "a" as const, label: question.optionA },
      { key: "b" as const, label: question.optionB },
      { key: "c" as const, label: question.optionC },
      { key: "d" as const, label: question.optionD },
    ].filter((opt) => opt.label?.trim());
  }, [question]);

  if (!question || total === 0) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        No practice questions are available for this course yet.
      </p>
    );
  }

  const isCorrect = selected === question.correctAnswer;
  const promptPa = question.questionTextPa?.trim();
  const explainPa = question.explanationPa?.trim();
  const explainEn = question.explanation?.trim();

  function choose(key: string) {
    if (revealed) return;
    setSelected(key);
  }

  function check() {
    if (!selected) return;
    setRevealed(true);
  }

  function goNext() {
    if (index >= total - 1) return;
    setIndex((value) => value + 1);
    setSelected(null);
    setRevealed(false);
  }

  function goPrev() {
    if (index <= 0) return;
    setIndex((value) => value - 1);
    setSelected(null);
    setRevealed(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
            Practice bank
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Untimed · {total} questions · {courseName}
          </p>
        </div>
        <EnglishBilingualToggle showEnglish={showEnglish} onChange={setShowEnglish} />
      </div>

      <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
        <span>
          Question {index + 1} of {total}
        </span>
        <Link
          href={`/dashboard/english/learn/${courseId}`}
          className="text-emerald-700 hover:text-emerald-600"
        >
          Back to course
        </Link>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-5">
        {promptPa ? (
          <p className="text-base font-medium leading-snug text-zinc-900">{promptPa}</p>
        ) : null}
        {showEnglish ? (
          <p
            className={cn(
              "text-sm leading-snug text-zinc-600",
              promptPa ? "mt-2" : "text-base font-medium text-zinc-900"
            )}
          >
            {question.questionText}
          </p>
        ) : null}
        {!promptPa && !showEnglish ? (
          <p className="text-base font-medium text-zinc-900">{question.questionText}</p>
        ) : null}

        <div className="mt-4 space-y-2">
          {optionLabels.map((opt) => {
            const chosen = selected === opt.key;
            const showResult = revealed && chosen;
            const isAnswer = revealed && opt.key === question.correctAnswer;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => choose(opt.key)}
                disabled={revealed}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left text-sm transition-colors",
                  isAnswer
                    ? "border-emerald-400 bg-emerald-50 text-emerald-950"
                    : showResult && !isCorrect
                      ? "border-red-300 bg-red-50 text-red-950"
                      : chosen
                        ? "border-emerald-400 bg-emerald-50/70 text-zinc-900"
                        : "border-zinc-200 bg-white text-zinc-800 hover:border-emerald-300"
                )}
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold uppercase text-zinc-600">
                  {opt.key}
                </span>
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

        {!revealed ? (
          <button
            type="button"
            onClick={check}
            disabled={!selected}
            className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Check answer
          </button>
        ) : (
          <div className="mt-4 space-y-3">
            <p
              className={cn(
                "text-sm font-semibold",
                isCorrect ? "text-emerald-700" : "text-red-700"
              )}
            >
              {isCorrect ? "Correct" : "Not quite"}
              {!isCorrect
                ? ` — answer ${question.correctAnswer.toUpperCase()}`
                : ""}
            </p>
            {(explainPa || explainEn) && (
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-3 text-sm text-zinc-700">
                {explainPa ? <p>{explainPa}</p> : null}
                {showEnglish && explainEn ? (
                  <p className={cn(explainPa ? "mt-1.5 text-zinc-600" : "")}>
                    {explainEn}
                  </p>
                ) : null}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={goPrev}
                disabled={index === 0}
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={index >= total - 1}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
              >
                {index >= total - 1 ? "Done" : "Next"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
