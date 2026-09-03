"use client";

import { BackLink } from "@/components/navigation/back-link";
import { FlashcardBilingualLine } from "@/components/flashcards/flashcard-bilingual-line";
import { useMemo, useState } from "react";
import { SessionProgressBar } from "@/components/session-progress-bar";
import type { FlashcardDeckCard, FlashcardDeckContext } from "@/lib/flashcards/types";
import { deckPracticeHref, pickDistinctTexts, shuffleArray } from "@/lib/flashcards/utils";

type FlashcardTestModeProps = {
  deck: FlashcardDeckContext;
};

type TestLine = {
  value: string;
  text: string;
  romanised: string | null;
};

type Question = {
  cardId: string;
  prompt: Omit<TestLine, "value">;
  correctAnswer: string;
  options: TestLine[];
};

const TRAILING_ROMANISATION = /^(.*?)\s*\(([^)]+)\)\s*$/u;
const GURMUKHI = /[\u0A00-\u0A7F]/;

function testLine(
  text: string,
  romanised: string | null
): { text: string; romanised: string | null } {
  const latin = romanised?.trim() || null;
  if (latin) {
    const match = text.trim().match(TRAILING_ROMANISATION);
    if (match && GURMUKHI.test(match[1])) {
      return { text: match[1].trim(), romanised: latin };
    }
  }
  return { text, romanised: latin };
}

function romanisedForBack(cards: FlashcardDeckCard[], backText: string): string | null {
  return cards.find((card) => card.back_text === backText)?.romanised?.trim() || null;
}

function buildQuestions(deck: FlashcardDeckContext): Question[] {
  const backs = deck.cards.map((card) => card.back_text);

  return shuffleArray(deck.cards).map((card) => {
    const wrongAnswers = pickDistinctTexts(backs, 3, card.back_text);
    const options = shuffleArray([card.back_text, ...wrongAnswers]).map((text) => {
      const line = testLine(
        text,
        text === card.back_text
          ? card.romanised
          : romanisedForBack(deck.cards, text)
      );
      return { value: text, ...line };
    });

    return {
      cardId: card.id,
      prompt: testLine(card.front_text, card.romanised),
      correctAnswer: card.back_text,
      options,
    };
  });
}

export function FlashcardTestMode({ deck }: FlashcardTestModeProps) {
  const deckHubHref =
    deck.deckId != null
      ? deckPracticeHref(deck.lessonId, deck.deckId)
      : `/dashboard/practice/flashcards/${deck.lessonId}`;

  const questions = useMemo(() => buildQuestions(deck), [deck]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const question = questions[index];

  function handleSelect(optionText: string) {
    if (selected) return;
    setSelected(optionText);
    if (optionText === question.correctAnswer) {
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
        <BackLink
          fallbackHref={deckHubHref}
          className="block rounded-lg bg-violet-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-violet-500"
        >
          ← Back
        </BackLink>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SessionProgressBar current={index + 1} total={questions.length} />
      <div>
        <BackLink fallbackHref={deckHubHref}>← Back</BackLink>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-violet-600">
          Test · {deck.deckName}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">{deck.lessonTitle}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Question {index + 1} of {questions.length}
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <FlashcardBilingualLine
          text={question.prompt.text}
          romanised={question.prompt.romanised}
          gurmukhiClassName="text-lg font-medium text-zinc-900"
          romanisedClassName="mt-1 block text-sm font-normal text-violet-600"
        />
        <div className="mt-4 space-y-2">
          {question.options.map((option) => {
            const isSelected = selected === option.value;
            const isCorrect = option.value === question.correctAnswer;
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
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={className}
              >
                <FlashcardBilingualLine
                  text={option.text}
                  romanised={option.romanised}
                  gurmukhiClassName="font-medium text-zinc-900"
                  romanisedClassName="mt-0.5 block text-sm font-normal text-violet-600"
                />
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
