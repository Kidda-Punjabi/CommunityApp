"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { EnglishBilingualToggle } from "@/components/english/english-bilingual-toggle";
import type {
  EnglishExamCourseConfig,
  EnglishExamQuestion,
} from "@/lib/learning/english-exam-courses";
import { drawEnglishMockQuestions } from "@/lib/learning/load-english-exam-content";
import { cn } from "@/lib/ui/styles";

type EnglishMockTestProps = {
  courseName: string;
  courseId: string;
  config: EnglishExamCourseConfig;
  bank: EnglishExamQuestion[];
};

type Phase = "intro" | "testing" | "results";

function formatClock(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function EnglishMockTest({
  courseName,
  courseId,
  config,
  bank,
}: EnglishMockTestProps) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [questions, setQuestions] = useState<EnglishExamQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState(config.mockMinutes * 60);
  const [showEnglish, setShowEnglish] = useState(true);
  const finishedRef = useRef(false);

  const question = questions[index];
  const answeredCount = Object.keys(answers).length;

  const optionLabels = useMemo(() => {
    if (!question) return [];
    return [
      { key: "a" as const, label: question.optionA },
      { key: "b" as const, label: question.optionB },
      { key: "c" as const, label: question.optionC },
      { key: "d" as const, label: question.optionD },
    ].filter((opt) => opt.label?.trim());
  }, [question]);

  const score = useMemo(() => {
    let correct = 0;
    for (const item of questions) {
      if (answers[item.id] === item.correctAnswer) correct += 1;
    }
    return correct;
  }, [answers, questions]);

  const passed = score >= config.passCorrect;
  const percent =
    questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  function startTest() {
    finishedRef.current = false;
    const drawn = drawEnglishMockQuestions(bank, config.mockQuestionCount);
    setQuestions(drawn);
    setAnswers({});
    setIndex(0);
    setSecondsLeft(config.mockMinutes * 60);
    setPhase("testing");
  }

  function finishTest() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setPhase("results");
  }

  useEffect(() => {
    if (phase !== "testing") return;
    if (secondsLeft <= 0) {
      if (!finishedRef.current) {
        finishedRef.current = true;
        setPhase("results");
      }
      return;
    }
    const id = window.setTimeout(() => {
      setSecondsLeft((value) => value - 1);
    }, 1000);
    return () => window.clearTimeout(id);
  }, [phase, secondsLeft]);

  if (bank.length === 0) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        No mock questions are available for this course yet.
      </p>
    );
  }

  if (phase === "intro") {
    return (
      <div className="space-y-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
            Mock test
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-900">{courseName}</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Timed practice matching the real exam format (multiple-choice only).
          </p>
        </div>

        <ul className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-4 text-sm text-emerald-950">
          <li>
            <span className="font-semibold">{config.mockQuestionCount}</span> questions
            (random, no repeats)
          </li>
          <li>
            <span className="font-semibold">{config.mockMinutes}</span> minutes
          </li>
          <li>
            Pass mark:{" "}
            <span className="font-semibold">
              {config.passCorrect}/{config.mockQuestionCount}
            </span>{" "}
            ({config.passPercent}%)
          </li>
        </ul>

        <p className="text-xs text-zinc-500">
          Bank size: {bank.length} questions. Your score is shown at the end — nothing is
          saved to your Punjabi progress.
        </p>

        <button
          type="button"
          onClick={startTest}
          className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Start mock test
        </button>

        <Link
          href={`/dashboard/english/learn/${courseId}`}
          className="block text-center text-sm font-medium text-emerald-700 hover:text-emerald-600"
        >
          ← Back to course
        </Link>
      </div>
    );
  }

  if (phase === "results") {
    return (
      <div className="space-y-5">
        <div
          className={cn(
            "rounded-2xl border px-5 py-6 text-center",
            passed
              ? "border-emerald-300 bg-emerald-50"
              : "border-amber-300 bg-amber-50"
          )}
        >
          <p
            className={cn(
              "text-xs font-semibold uppercase tracking-wide",
              passed ? "text-emerald-700" : "text-amber-800"
            )}
          >
            {passed ? "Pass" : "Not yet"}
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-zinc-900">
            {score}/{questions.length}
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            {percent}% · need {config.passCorrect}/{config.mockQuestionCount} (
            {config.passPercent}%) to pass
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={startTest}
            className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Try another mock
          </button>
          <Link
            href={`/dashboard/english/learn/${courseId}/practice`}
            className="inline-flex w-full items-center justify-center rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-emerald-800"
          >
            Review in practice bank
          </Link>
          <Link
            href={`/dashboard/english/learn/${courseId}`}
            className="block text-center text-sm font-medium text-emerald-700"
          >
            ← Back to course
          </Link>
        </div>
      </div>
    );
  }

  // testing phase
  if (!question) {
    return null;
  }

  const promptPa = question.questionTextPa?.trim();
  const urgent = secondsLeft <= 60;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums",
            urgent
              ? "bg-red-100 text-red-800"
              : "bg-zinc-100 text-zinc-800"
          )}
          aria-live="polite"
        >
          {formatClock(secondsLeft)}
        </div>
        <EnglishBilingualToggle showEnglish={showEnglish} onChange={setShowEnglish} />
      </div>

      <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
        <span>
          Question {index + 1} of {questions.length}
        </span>
        <span>
          Answered {answeredCount}/{questions.length}
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${((index + 1) / questions.length) * 100}%` }}
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
            const chosen = answers[question.id] === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() =>
                  setAnswers((prev) => ({ ...prev, [question.id]: opt.key }))
                }
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left text-sm transition-colors",
                  chosen
                    ? "border-emerald-400 bg-emerald-50 text-zinc-900"
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
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setIndex((value) => Math.max(0, value - 1))}
          disabled={index === 0}
          className="inline-flex flex-1 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 disabled:opacity-40"
        >
          Previous
        </button>
        {index < questions.length - 1 ? (
          <button
            type="button"
            onClick={() => setIndex((value) => value + 1)}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={finishTest}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Submit test
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={finishTest}
        className="w-full text-center text-xs font-medium text-zinc-500 underline-offset-2 hover:underline"
      >
        End test early
      </button>
    </div>
  );
}
