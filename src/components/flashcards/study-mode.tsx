"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DeckProgressBar } from "@/components/deck-progress-bar";
import { createClient } from "@/lib/supabase/client";
import type { FlashcardDeckContext } from "@/lib/flashcards/types";
import { shuffleArray } from "@/lib/flashcards/utils";
import {
  computeDeckConfidenceStats,
  saveFlashcardConfidence,
  type FlashcardConfidence,
  type FlashcardProgressRow,
} from "@/lib/progress/flashcard-progress";
import { updateUserStreak } from "@/lib/progress/streak";

type FlashcardStudyModeProps = {
  deck: FlashcardDeckContext;
  initialProgress: FlashcardProgressRow[];
};

export function FlashcardStudyMode({ deck, initialProgress }: FlashcardStudyModeProps) {
  const [shuffled, setShuffled] = useState(false);
  const [showBackFirst, setShowBackFirst] = useState(false);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [progressMap, setProgressMap] = useState(
    () => new Map(initialProgress.map((row) => [row.flashcard_id, row]))
  );

  const userIdRef = useRef<string | null>(null);
  const streakUpdatedRef = useRef(false);
  const touchStartXRef = useRef(0);

  const orderedCards = useMemo(
    () => (shuffled ? shuffleArray(deck.cards) : deck.cards),
    [deck.cards, shuffled]
  );

  const card = orderedCards[index];
  const cardProgress = progressMap.get(card.id);
  const stats = computeDeckConfidenceStats(
    deck.cards.map((item) => item.id),
    progressMap
  );

  const promptText = showBackFirst ? card.back_text : card.front_text;
  const answerText = showBackFirst ? card.front_text : card.back_text;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      userIdRef.current = user?.id ?? null;
    });
  }, []);

  useEffect(() => {
    setIndex(0);
    setFlipped(false);
  }, [shuffled, showBackFirst]);

  async function recordConfidence(confidence: FlashcardConfidence) {
    const userId = userIdRef.current;
    if (!userId) return;

    const supabase = createClient();
    await saveFlashcardConfidence(supabase, userId, card.id, confidence);

    setProgressMap((prev) => {
      const next = new Map(prev);
      next.set(card.id, { flashcard_id: card.id, confidence });
      return next;
    });

    if (!streakUpdatedRef.current) {
      streakUpdatedRef.current = true;
      await updateUserStreak(supabase, userId);
    }

    if (index < orderedCards.length - 1) {
      setIndex((prev) => prev + 1);
      setFlipped(false);
    }
  }

  function goNext() {
    setIndex((prev) => Math.min(prev + 1, orderedCards.length - 1));
    setFlipped(false);
  }

  function goPrev() {
    setIndex((prev) => Math.max(prev - 1, 0));
    setFlipped(false);
  }

  function handleTouchStart(event: React.TouchEvent) {
    touchStartXRef.current = event.touches[0]?.clientX ?? 0;
  }

  function handleTouchEnd(event: React.TouchEvent) {
    if (!flipped) return;

    const touchEndX = event.changedTouches[0]?.clientX ?? 0;
    const delta = touchEndX - touchStartXRef.current;
    if (Math.abs(delta) < 60) return;

    if (delta > 0) void recordConfidence("confident");
    else void recordConfidence("not_confident");
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
          Flashcards · {deck.deckName}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">{deck.lessonTitle}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Card {index + 1} of {orderedCards.length}
        </p>
        <DeckProgressBar
          confident={stats.confident}
          notConfident={stats.notConfident}
          total={stats.total}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShuffled((prev) => !prev)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            shuffled
              ? "bg-violet-600 text-white"
              : "border border-zinc-200 bg-white text-zinc-700"
          }`}
        >
          Shuffle {shuffled ? "on" : "off"}
        </button>
        <button
          type="button"
          onClick={() => setShowBackFirst((prev) => !prev)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            showBackFirst
              ? "bg-violet-600 text-white"
              : "border border-zinc-200 bg-white text-zinc-700"
          }`}
        >
          {showBackFirst ? "Back first" : "Front first"}
        </button>
      </div>

      <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className="space-y-3">
        <button
          type="button"
          onClick={() => setFlipped((prev) => !prev)}
          className="min-h-56 w-full rounded-2xl border border-zinc-200 bg-white p-6 text-left shadow-sm transition-colors hover:border-violet-300"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {flipped ? "Answer" : "Prompt"}
          </p>
          <p className="mt-4 text-xl font-semibold text-zinc-900">
            {flipped ? answerText : promptText}
          </p>
          <p className="mt-6 text-sm text-violet-600">
            {flipped
              ? "Swipe right = confident · left = not confident"
              : "Tap to flip"}
          </p>
          {cardProgress && (
            <p className="mt-2 text-xs font-medium text-zinc-500">
              Last rated:{" "}
              {cardProgress.confidence === "confident" ? "Confident" : "Not confident"}
            </p>
          )}
        </button>

        {flipped && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void recordConfidence("not_confident")}
              className="flex-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 hover:bg-amber-100"
            >
              Not confident
            </button>
            <button
              type="button"
              onClick={() => void recordConfidence("confident")}
              className="flex-1 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800 hover:bg-green-100"
            >
              Confident
            </button>
          </div>
        )}
      </div>

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
          disabled={index === orderedCards.length - 1}
          className="flex-1 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
