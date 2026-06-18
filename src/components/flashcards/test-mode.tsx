"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { FlashcardDeckContext } from "@/lib/flashcards/types";
import { pickRandomItems, shuffleArray } from "@/lib/flashcards/utils";

type FlashcardTestModeProps = {
  deck: FlashcardDeckContext;
};

type Question = {
  cardId: string;
  prompt: string;
  correctAnswer: string;
  options: string[];
};

function buildQuestions(deck: FlashcardDeckContext): Question[] {
  const backs = deck.cards.map((card) => card.back_text);

  return shuffleArray(deck.cards).map((card) => {
    const wrongCount = Math.min(3, Math.max(backs.length - 1, 0));
    const wrongAnswers = pickRandomItems(backs, wrongCount, card.back_text);
    const options = shuffleArray([card.back_text, ...wrongAnswers]);

    return {
      cardId: card.id,
      prompt: card.front_text,
      correctAnswer: card.back_text,
      options,
    };
  });
}

export function FlashcardTestMode({ deck }: FlashcardTestModeProps) {
  const questions = useMemo(() => buildQuestions(deck), [deck]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const question = questions[index];

  function handleSelect(option: string) {
    if (selected) return;
    setSelected(option);
    if (option === question.correctAnswer) {
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
      <div className="space-y-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-violet-600">Test complete</p>
          <h2 className="mt-2 text-2xl font-bold text-zinc-900">
            {score} / {questions.length} correct
          </h2>
        </div>
        <Link
          href={`/dashboard/practice/flashcards/${deck.lessonId}`}
          className="block rounded-lg bg-violet-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-violet-500"
        >
          Back to deck
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/dashboard/practice/flashcards/${deck.lessonId}`}
          className="text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          ← Back to deck
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-violet-600">
          Test · {deck.deckName}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">{deck.lessonTitle}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Question {index + 1} of {questions.length}
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-lg font-medium text-zinc-900">{question.prompt}</p>
        <div className="mt-4 space-y-2">
          {question.options.map((option) => {
            const isSelected = selected === option;
            const isCorrect = option === question.correctAnswer;
            const showResult = Boolean(selected);

            let className =
              "w-full rounded-xl border px-4 py-3 text-left text-sm font-medium text-zinc-900 transition-colors ";

            if (!showResult) {
              className +=
                "border-zinc-200 bg-white hover:border-violet-300 hover:bg-violet-50";
            } else if (isCorrect) {
              className += "border-green-300 bg-green-50 text-green-900";
            } else if (isSelected) {
              className += "border-red-300 bg-red-50 text-red-900";
            } else {
              className += "border-zinc-200 bg-zinc-50 text-zinc-700";
            }

            return (
              <button
                key={option}
                type="button"
                onClick={() => handleSelect(option)}
                className={className}
              >
                {option}
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
