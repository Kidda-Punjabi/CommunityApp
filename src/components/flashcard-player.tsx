"use client";

import { useState } from "react";
import Link from "next/link";

export type FlashcardItem = {
  id: string;
  front_text: string;
  back_text: string;
};

type FlashcardPlayerProps = {
  lessonTitle: string;
  courseName: string;
  lessonNumber: number;
  cards: FlashcardItem[];
};

export function FlashcardPlayer({
  lessonTitle,
  courseName,
  lessonNumber,
  cards,
}: FlashcardPlayerProps) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const card = cards[index];

  function goNext() {
    setIndex((prev) => Math.min(prev + 1, cards.length - 1));
    setFlipped(false);
  }

  function goPrev() {
    setIndex((prev) => Math.max(prev - 1, 0));
    setFlipped(false);
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
          {courseName} · Lesson {lessonNumber}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">{lessonTitle}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Card {index + 1} of {cards.length}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((prev) => !prev)}
        className="min-h-56 w-full rounded-2xl border border-zinc-200 bg-white p-6 text-left shadow-sm transition-colors hover:border-violet-300"
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {flipped ? "Back" : "Front"}
        </p>
        <p className="mt-4 text-xl font-semibold text-zinc-900">
          {flipped ? card.back_text : card.front_text}
        </p>
        <p className="mt-6 text-sm text-violet-600">Tap to flip</p>
      </button>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={goPrev}
          disabled={index === 0}
          className="flex-1 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={index === cards.length - 1}
          className="flex-1 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
        >
          Next
        </button>
      </div>

      <Link
        href="/dashboard/learn"
        className="block text-center text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← Back to Learn
      </Link>
    </div>
  );
}
