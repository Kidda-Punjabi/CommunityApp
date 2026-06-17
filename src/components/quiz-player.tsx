"use client";

import { useState } from "react";
import Link from "next/link";

export type QuizQuestion = {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  question_order: number;
};

type QuizPlayerProps = {
  quizTitle: string;
  courseName: string;
  lessonNumber: number | null;
  questions: QuizQuestion[];
};

export function QuizPlayer({
  quizTitle,
  courseName,
  lessonNumber,
  questions,
}: QuizPlayerProps) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const question = questions[index];
  const options = [
    { key: "a", label: question.option_a },
    { key: "b", label: question.option_b },
    { key: "c", label: question.option_c },
    { key: "d", label: question.option_d },
  ];

  function handleSelect(optionKey: string) {
    if (selected) return;
    setSelected(optionKey);
    if (optionKey === question.correct_answer) {
      setScore((prev) => prev + 1);
    }
  }

  function handleNext() {
    if (index + 1 >= questions.length) {
      setFinished(true);
      return;
    }
    setIndex((prev) => prev + 1);
    setSelected(null);
  }

  if (finished) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-medium text-violet-600">Quiz complete</p>
        <h2 className="mt-2 text-2xl font-bold text-zinc-900">
          {score} / {questions.length} correct
        </h2>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/dashboard/learn"
            className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
          >
            Back to Learn
          </Link>
          <Link
            href="/dashboard/practice"
            className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Practice hub
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
          {courseName}
          {lessonNumber ? ` · Lesson ${lessonNumber}` : ""}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">{quizTitle}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Question {index + 1} of {questions.length}
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-lg font-medium text-zinc-900">{question.question_text}</p>
        <div className="mt-4 space-y-2">
          {options.map((option) => {
            const isSelected = selected === option.key;
            const isCorrect = option.key === question.correct_answer;
            const showResult = Boolean(selected);

            let className =
              "w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ";

            if (!showResult) {
              className += "border-zinc-200 hover:border-violet-300 hover:bg-violet-50";
            } else if (isCorrect) {
              className += "border-green-300 bg-green-50 text-green-800";
            } else if (isSelected) {
              className += "border-red-300 bg-red-50 text-red-800";
            } else {
              className += "border-zinc-200 text-zinc-500";
            }

            return (
              <button
                key={option.key}
                type="button"
                onClick={() => handleSelect(option.key)}
                className={className}
              >
                <span className="font-semibold uppercase">{option.key}.</span> {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={handleNext}
        disabled={!selected}
        className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {index + 1 >= questions.length ? "See results" : "Next question"}
      </button>
    </div>
  );
}
