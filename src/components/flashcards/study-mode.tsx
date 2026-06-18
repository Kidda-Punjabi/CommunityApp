"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DeckProgressBar } from "@/components/deck-progress-bar";
import { createClient } from "@/lib/supabase/client";
import type { FlashcardDeckContext } from "@/lib/flashcards/types";
import { deckPracticeHref, shuffleArray } from "@/lib/flashcards/utils";
import {
  computeDeckConfidenceStats,
  saveFlashcardConfidence,
  type FlashcardConfidence,
  type FlashcardProgressRow,
} from "@/lib/progress/flashcard-progress";
import { recordStreakActivity, type StreakResult } from "@/lib/progress/streak";

type FlashcardStudyModeProps = {
  deck: FlashcardDeckContext;
  initialProgress: FlashcardProgressRow[];
};

type SessionPhase = "studying" | "summary";

export function FlashcardStudyMode({ deck, initialProgress }: FlashcardStudyModeProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<SessionPhase>("studying");
  const [reviewMode, setReviewMode] = useState(false);
  const [streakResult, setStreakResult] = useState<StreakResult | null>(null);
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

  const deckHubHref =
    deck.deckId != null
      ? deckPracticeHref(deck.lessonId, deck.deckId)
      : `/dashboard/practice/flashcards/${deck.lessonId}`;

  const activeCards = useMemo(() => {
    if (!reviewMode) return deck.cards;
    return deck.cards.filter(
      (card) => progressMap.get(card.id)?.confidence === "not_confident"
    );
  }, [deck.cards, reviewMode, progressMap]);

  const orderedCards = useMemo(
    () => (shuffled ? shuffleArray(activeCards) : activeCards),
    [activeCards, shuffled]
  );

  const fullStats = computeDeckConfidenceStats(
    deck.cards.map((item) => item.id),
    progressMap
  );

  const allConfident =
    fullStats.total > 0 && fullStats.confident === fullStats.total;

  const startedAllConfidentRef = useRef(
    computeDeckConfidenceStats(
      deck.cards.map((item) => item.id),
      new Map(initialProgress.map((row) => [row.flashcard_id, row]))
    ).confident === deck.cards.length && deck.cards.length > 0
  );

  const card = orderedCards[index];
  const cardProgress = card ? progressMap.get(card.id) : undefined;

  const promptText = card
    ? showBackFirst
      ? card.back_text
      : card.front_text
    : "";
  const answerText = card
    ? showBackFirst
      ? card.front_text
      : card.back_text
    : "";

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      userIdRef.current = user?.id ?? null;
    });
  }, []);

  useEffect(() => {
    setIndex(0);
    setFlipped(false);
  }, [shuffled, showBackFirst, reviewMode]);

  useEffect(() => {
    if (phase === "studying" && reviewMode && activeCards.length === 0) {
      setPhase("summary");
    }
  }, [phase, reviewMode, activeCards.length]);

  useEffect(() => {
    if (phase !== "summary" || !allConfident || streakUpdatedRef.current) return;
    if (startedAllConfidentRef.current) return;

    const userId = userIdRef.current;
    if (!userId) return;

    streakUpdatedRef.current = true;
    const supabase = createClient();
    void recordStreakActivity(supabase, userId)
      .then(setStreakResult)
      .catch((error) => {
        console.error("Failed to record streak activity:", error);
        streakUpdatedRef.current = false;
      });
  }, [phase, allConfident]);

  async function recordConfidence(confidence: FlashcardConfidence) {
    if (!card) return;

    const userId = userIdRef.current;
    if (!userId) return;

    const supabase = createClient();
    await saveFlashcardConfidence(supabase, userId, card.id, confidence);

    setProgressMap((prev) => {
      const next = new Map(prev);
      next.set(card.id, { flashcard_id: card.id, confidence });
      return next;
    });

    if (index < orderedCards.length - 1) {
      setIndex((prev) => prev + 1);
      setFlipped(false);
    } else {
      setPhase("summary");
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
    if (!flipped || phase !== "studying") return;

    const touchEndX = event.changedTouches[0]?.clientX ?? 0;
    const delta = touchEndX - touchStartXRef.current;
    if (Math.abs(delta) < 60) return;

    if (delta > 0) void recordConfidence("confident");
    else void recordConfidence("not_confident");
  }

  function startReview() {
    setReviewMode(true);
    setPhase("studying");
    setIndex(0);
    setFlipped(false);
  }

  function finishSession() {
    router.push(deckHubHref);
  }

  if (phase === "summary") {
    return (
      <StudySessionSummary
        deck={deck}
        stats={fullStats}
        allConfident={allConfident}
        reviewMode={reviewMode}
        streakResult={streakResult}
        onReview={startReview}
        onFinish={finishSession}
        deckHubHref={deckHubHref}
      />
    );
  }

  if (!card) {
    return (
      <StudySessionSummary
        deck={deck}
        stats={fullStats}
        allConfident={allConfident}
        reviewMode={reviewMode}
        streakResult={streakResult}
        onReview={startReview}
        onFinish={finishSession}
        deckHubHref={deckHubHref}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={deckHubHref}
          className="text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          ← Back to deck
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-violet-600">
          Flashcards · {deck.deckName}
          {reviewMode && " · Review"}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">{deck.lessonTitle}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Card {index + 1} of {orderedCards.length}
          {reviewMode ? " (not confident)" : ""}
        </p>
        <DeckProgressBar
          confident={fullStats.confident}
          notConfident={fullStats.notConfident}
          total={fullStats.total}
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

      <div className="space-y-3">
        <div
          className="relative"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              goPrev();
            }}
            disabled={index === 0}
            aria-label="Previous card"
            className="absolute left-2 top-2 z-10 rounded-full p-1.5 text-lg leading-none text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 disabled:pointer-events-none disabled:opacity-30"
          >
            ←
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              goNext();
            }}
            disabled={index === orderedCards.length - 1}
            aria-label="Next card"
            className="absolute right-2 top-2 z-10 rounded-full p-1.5 text-lg leading-none text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 disabled:pointer-events-none disabled:opacity-30"
          >
            →
          </button>

          <button
            type="button"
            onClick={() => setFlipped((prev) => !prev)}
            className="min-h-56 w-full rounded-2xl border border-zinc-200 bg-white px-6 pb-6 pt-10 text-left shadow-sm transition-colors hover:border-violet-300"
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
        </div>

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
    </div>
  );
}

function StudySessionSummary({
  deck,
  stats,
  allConfident,
  reviewMode,
  streakResult,
  onReview,
  onFinish,
  deckHubHref,
}: {
  deck: FlashcardDeckContext;
  stats: ReturnType<typeof computeDeckConfidenceStats>;
  allConfident: boolean;
  reviewMode: boolean;
  streakResult: StreakResult | null;
  onReview: () => void;
  onFinish: () => void;
  deckHubHref: string;
}) {
  const hasNotConfident = stats.notConfident > 0;

  return (
    <div className="flex flex-1 flex-col">
      <Link
        href={deckHubHref}
        className="text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← Back to deck
      </Link>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
        {allConfident ? (
          <>
            <span className="text-5xl" role="img" aria-hidden="true">
              ✓
            </span>
            <h2 className="mt-4 text-2xl font-bold text-zinc-900">Set complete!</h2>
            <p className="mt-2 max-w-sm text-sm text-zinc-600">
              All {stats.total} card{stats.total === 1 ? "" : "s"} confident in{" "}
              <span className="font-medium text-zinc-800">{deck.deckName}</span>.
            </p>
            {streakResult?.streak_rescued && (
              <p className="mt-3 rounded-lg bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
                Streak rescued! Back to {streakResult.display_streak} day
                {streakResult.display_streak === 1 ? "" : "s"}.
              </p>
            )}
            <button
              type="button"
              onClick={onFinish}
              className="mt-8 rounded-lg bg-violet-600 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-500"
            >
              Done
            </button>
          </>
        ) : (
          <>
            <span className="text-5xl" role="img" aria-hidden="true">
              📚
            </span>
            <h2 className="mt-4 text-2xl font-bold text-zinc-900">
              {reviewMode ? "Review round complete" : "Session complete"}
            </h2>
            <p className="mt-2 max-w-sm text-sm text-zinc-600">
              <span className="font-semibold text-violet-600">{stats.confident}</span> of{" "}
              {stats.total} card{stats.total === 1 ? "" : "s"} confident
            </p>
            <DeckProgressBar
              confident={stats.confident}
              notConfident={stats.notConfident}
              total={stats.total}
            />
            <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
              {hasNotConfident && (
                <button
                  type="button"
                  onClick={onReview}
                  className="rounded-lg bg-violet-600 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-500"
                >
                  Review not confident cards
                </button>
              )}
              <button
                type="button"
                onClick={onFinish}
                className="rounded-lg border border-zinc-200 px-6 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Finish for now
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
