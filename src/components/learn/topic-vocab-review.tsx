"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { FlashcardDeckCard } from "@/lib/flashcards/types";
import { markTopicVocabReviewed } from "@/app/dashboard/learn/free/actions";

type TopicVocabReviewProps = {
  lessonId: string;
  topicTitle: string;
  cards: FlashcardDeckCard[];
  initiallyReviewedIds: string[];
};

export function TopicVocabReview({
  lessonId,
  topicTitle,
  cards,
  initiallyReviewedIds,
}: TopicVocabReviewProps) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(() => new Set(initiallyReviewedIds));
  const [pending, startTransition] = useTransition();

  if (cards.length === 0) {
    return (
      <p className="text-center text-sm text-zinc-500">
        Vocab for this topic is coming soon.
      </p>
    );
  }

  const card = cards[index];
  const done = index >= cards.length;

  if (done) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="font-heading text-2xl font-semibold text-zinc-900">
          Vocab reviewed
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          {reviewed.size} of {cards.length} words marked in {topicTitle}.
        </p>
        <button
          type="button"
          onClick={() => router.push(`/dashboard/learn/free/${lessonId}`)}
          className="mt-8 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-600"
        >
          Back to topic
        </button>
      </div>
    );
  }

  function markAndAdvance(confident: boolean) {
    startTransition(async () => {
      await markTopicVocabReviewed({
        lessonId,
        flashcardId: card.id,
        confident,
      });
      setReviewed((prev) => new Set(prev).add(card.id));
      setFlipped(false);
      setIndex((value) => value + 1);
    });
  }

  return (
    <div className="mx-auto max-w-md text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Review Vocab
      </p>
      <h1 className="mt-1 font-heading text-xl font-semibold text-zinc-900">
        {topicTitle}
      </h1>
      <p className="mt-1 text-xs text-zinc-400">
        {index + 1} of {cards.length} · {reviewed.size} reviewed
      </p>

      <button
        type="button"
        onClick={() => setFlipped((value) => !value)}
        className="mt-6 flex min-h-48 w-full flex-col items-center justify-center rounded-3xl border border-zinc-200 bg-white px-6 py-8 shadow-sm"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          {flipped ? "Punjabi" : "English"}
        </p>
        <p className="mt-3 text-2xl font-semibold leading-snug text-zinc-900">
          {flipped ? card.back_text : card.front_text}
        </p>
        {flipped && card.romanised ? (
          <p className="mt-2 text-sm text-zinc-500">{card.romanised}</p>
        ) : null}
        <p className="mt-4 text-xs text-zinc-400">Tap to flip</p>
      </button>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => markAndAdvance(false)}
          className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
        >
          Still learning
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => markAndAdvance(true)}
          className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
        >
          Know it
        </button>
      </div>
    </div>
  );
}
