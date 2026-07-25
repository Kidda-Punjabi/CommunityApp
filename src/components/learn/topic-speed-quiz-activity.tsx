"use client";

import { useMemo, useState } from "react";
import type { FlashcardDeckCard } from "@/lib/flashcards/types";
import { PunjabiWithRomanisation } from "@/components/learn/punjabi-with-romanisation";
import { TopicListenButton } from "@/components/learn/topic-listen-button";
import {
  buildRomanisationLookup,
  cardPunjabiDisplay,
  containsGurmukhi,
  pickCards,
  shuffleInPlace,
} from "@/lib/free-lessons/topic-game-utils";

type TopicSpeedQuizActivityProps = {
  cards: FlashcardDeckCard[];
  itemCount: number;
  passThreshold: number;
  title: string;
  subtitle: string;
  reverse?: boolean;
  onComplete: (result: { percent: number; correct: number; total: number }) => void;
};

type QuizOption = {
  text: string;
  romanised: string | null;
};

export function TopicSpeedQuizActivity({
  cards,
  itemCount,
  passThreshold,
  title,
  subtitle,
  reverse = false,
  onComplete,
}: TopicSpeedQuizActivityProps) {
  const queue = useMemo(
    () => pickCards(cards, Math.min(itemCount, cards.length)),
    [cards, itemCount]
  );
  const romanisationByText = useMemo(
    () => buildRomanisationLookup(cards),
    [cards]
  );
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  const card = queue[index];
  const promptGurmukhi = card
    ? reverse
      ? cardPunjabiDisplay(card).gurmukhi
      : card.front_text
    : "";
  const promptRomanised = card && reverse ? cardPunjabiDisplay(card).romanised : "";
  const answerText = card
    ? reverse
      ? card.front_text
      : cardPunjabiDisplay(card).gurmukhi
    : "";
  const answerRomanised =
    card && !reverse ? cardPunjabiDisplay(card).romanised || null : null;

  const options = useMemo((): QuizOption[] => {
    if (!card || !answerText) return [];
    if (reverse) {
      const pool = cards.map((c) => c.front_text);
      const others = shuffleInPlace(pool.filter((item) => item !== answerText)).slice(
        0,
        3
      );
      return shuffleInPlace(
        [answerText, ...others].map((text) => ({ text, romanised: null }))
      );
    }
    const pool = cards.map((c) => cardPunjabiDisplay(c).gurmukhi);
    const others = shuffleInPlace(pool.filter((item) => item !== answerText)).slice(
      0,
      3
    );
    return shuffleInPlace(
      [answerText, ...others].map((text) => ({
        text,
        romanised: romanisationByText.get(text) ?? null,
      }))
    );
  }, [card, cards, answerText, reverse, romanisationByText]);

  function select(optionIndex: number) {
    if (revealed || !card) return;
    setSelected(optionIndex);
  }

  function checkAnswer() {
    if (selected === null || revealed) return;
    setRevealed(true);
  }

  function goNext() {
    if (selected === null || !card) return;
    const ok = options[selected]?.text === answerText;
    const nextCorrect = correctCount + (ok ? 1 : 0);
    setCorrectCount(nextCorrect);

    if (index + 1 < queue.length) {
      setIndex((value) => value + 1);
      setSelected(null);
      setRevealed(false);
      return;
    }

    const total = queue.length;
    const percent = total === 0 ? 0 : Math.round((nextCorrect / total) * 100);
    onComplete({ percent, correct: nextCorrect, total });
  }

  if (queue.length < 2) {
    return (
      <p className="text-center text-sm text-zinc-500">
        Need more words in this topic for a quiz.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-md text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Speed quiz
      </p>
      <h1 className="mt-1 font-heading text-xl font-semibold text-zinc-900">{title}</h1>
      <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-violet-500 transition-all"
          style={{
            width: `${((index + (revealed ? 1 : 0)) / queue.length) * 100}%`,
          }}
        />
      </div>
      <p className="mt-1.5 text-xs text-zinc-400">
        {index + 1} of {queue.length} · Pass at {passThreshold}%
      </p>

      <div className="mt-5 rounded-3xl border border-zinc-200 bg-white px-5 py-6 shadow-sm">
        <div className="flex items-start justify-center gap-2">
          <div className="min-w-0">
            {containsGurmukhi(promptGurmukhi) ? (
              <PunjabiWithRomanisation
                gurmukhi={promptGurmukhi}
                romanised={promptRomanised}
                textClassName="block text-lg font-semibold text-zinc-900"
                romanisedClassName="mt-1 block text-sm font-normal text-violet-600"
              />
            ) : (
              <p className="text-lg font-semibold text-zinc-900">{promptGurmukhi}</p>
            )}
          </div>
          {card?.audioUrl ? (
            <TopicListenButton audioUrl={card.audioUrl} label="Play pronunciation" />
          ) : null}
        </div>

        <ul className="mt-5 space-y-2.5">
          {options.map((option, optionIndex) => {
            const isSelected = selected === optionIndex;
            const isCorrect = option.text === answerText;
            let style = "border-zinc-200 bg-zinc-50 hover:bg-white";
            if (revealed && isCorrect) style = "border-emerald-400 bg-emerald-50";
            else if (revealed && isSelected && !isCorrect)
              style = "border-rose-300 bg-rose-50";
            else if (!revealed && isSelected)
              style = "border-violet-400 bg-violet-50";

            return (
              <li key={`${card.id}-${optionIndex}-${option.text}`}>
                <button
                  type="button"
                  disabled={revealed}
                  onClick={() => select(optionIndex)}
                  className={`w-full rounded-2xl border px-4 py-3 text-sm font-medium transition disabled:cursor-default ${style}`}
                >
                  {containsGurmukhi(option.text) ? (
                    <PunjabiWithRomanisation
                      gurmukhi={option.text}
                      romanised={
                        option.romanised ??
                        (isCorrect ? answerRomanised : null)
                      }
                    />
                  ) : (
                    option.text
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {!revealed ? (
          <button
            type="button"
            disabled={selected === null}
            onClick={checkAnswer}
            className="mt-5 w-full rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            Check answer
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            className="mt-5 w-full rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500"
          >
            {index + 1 < queue.length ? "Continue" : "See results"}
          </button>
        )}
      </div>
    </div>
  );
}
