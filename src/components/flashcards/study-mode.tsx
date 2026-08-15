"use client";

import { emojiForIcon } from "@/components/games/PictureMatch/emojiMap";
import { FlashcardBilingualLine } from "@/components/flashcards/flashcard-bilingual-line";
import { CatchupReturnButton } from "@/components/catchup/catchup-return-button";
import { FloatingSoundToggle } from "@/components/audio/floating-sound-toggle";
import { LessonFeedbackPanel } from "@/components/feedback/lesson-feedback-panel";
import { BackLink } from "@/components/navigation/back-link";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DeckProgressBar } from "@/components/deck-progress-bar";
import { useAudioManager } from "@/lib/audio/audio-manager";
import { usePlaySoundOnce } from "@/lib/audio/use-play-sound";
import { createClient } from "@/lib/supabase/client";
import type { FlashcardDeckCard, FlashcardDeckContext } from "@/lib/flashcards/types";
import { deckPracticeHref, shuffleArray } from "@/lib/flashcards/utils";
import {
  computeDeckConfidenceStats,
  saveFlashcardConfidence,
  type FlashcardConfidence,
  type FlashcardProgressRow,
} from "@/lib/progress/flashcard-progress";
import { sumPointsEarned } from "@/lib/points/notify-points-earned";
import { learningProductForFlashcard } from "@/lib/learning/learning-product";
import { recordStreakActivity, type StreakResult } from "@/lib/progress/streak";

type FlashcardStudyModeProps = {
  deck: FlashcardDeckContext;
  initialProgress: FlashcardProgressRow[];
  catchupReturn?: string | null;
  kidsMode?: boolean;
  onKidsComplete?: () => void | Promise<void>;
};

type SessionPhase = "studying" | "summary";

const TRAILING_ROMANISATION = /^(.*?)\s*\(([^)]+)\)\s*$/u;
const GURMUKHI = /[\u0A00-\u0A7F]/;

function studyCardLine(card: FlashcardDeckCard, text: string) {
  const romanised = card.romanised?.trim() || null;
  if (romanised && text === card.back_text) {
    const match = text.trim().match(TRAILING_ROMANISATION);
    if (match && GURMUKHI.test(match[1])) {
      return { text: match[1].trim(), romanised };
    }
  }
  return { text, romanised };
}

export function FlashcardStudyMode({
  deck,
  initialProgress,
  catchupReturn = null,
  kidsMode = false,
  onKidsComplete,
}: FlashcardStudyModeProps) {
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
  const { playSound } = useAudioManager();

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
  const shownText =
    kidsMode && !flipped ? "" : flipped ? answerText : kidsMode ? "?" : promptText;
  const shownLine = card && shownText ? studyCardLine(card, shownText) : null;

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
    if (kidsMode || phase !== "summary" || !allConfident || streakUpdatedRef.current) return;
    if (startedAllConfidentRef.current) return;

    const userId = userIdRef.current;
    const firstCardId = deck.cards[0]?.id;
    if (!userId || !firstCardId) return;

    streakUpdatedRef.current = true;
    const supabase = createClient();
    void learningProductForFlashcard(supabase, firstCardId)
      .then(async (product) => {
        if (product !== "punjabi") return;
        const result = await recordStreakActivity(supabase, userId);
        setStreakResult(result);
      })
      .catch((error) => {
        console.error("Failed to record streak activity:", error);
        streakUpdatedRef.current = false;
      });
  }, [phase, allConfident, kidsMode, deck.cards]);

  async function recordConfidence(confidence: FlashcardConfidence) {
    if (!card) return;

    playSound(confidence === "confident" ? "correct" : "incorrect");

    const userId = userIdRef.current;
    if (!userId) return;

    const supabase = createClient();
    const result = await saveFlashcardConfidence(supabase, userId, card.id, confidence);
    if (!kidsMode) {
      sumPointsEarned([result.flashcardPoints, result.lessonBonus]);
    }
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
        catchupReturn={catchupReturn}
        kidsMode={kidsMode}
        onKidsComplete={onKidsComplete}
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
        catchupReturn={catchupReturn}
        kidsMode={kidsMode}
        onKidsComplete={onKidsComplete}
      />
    );
  }

  return (
    <div className="relative space-y-4">
      {!kidsMode && <FloatingSoundToggle />}
      <div>
        <BackLink fallbackHref={deckHubHref} className="text-sm font-medium text-violet-600 hover:text-violet-500">← Back to deck</BackLink>
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

      {!kidsMode && (
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
      )}

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
            className={`min-h-56 w-full rounded-2xl border px-6 pb-6 pt-10 text-left shadow-sm transition-colors ${
              kidsMode
                ? "min-h-64 border-sky-200 bg-white hover:border-violet-300"
                : "border-zinc-200 bg-white hover:border-violet-300"
            }`}
          >
            {!kidsMode && (
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              {flipped ? "Answer" : "Prompt"}
            </p>
            )}
            {kidsMode && card?.icon_name && !flipped && (
              <p className="text-center text-6xl" aria-hidden>
                {emojiForIcon(card.icon_name)}
              </p>
            )}
            {shownLine ? (
              <FlashcardBilingualLine
                text={shownLine.text}
                romanised={shownLine.romanised}
                className={`text-zinc-900 ${kidsMode ? "mt-4 text-center" : "mt-4"}`}
                gurmukhiClassName={`font-semibold text-zinc-900 ${kidsMode ? "text-2xl" : "text-xl"}`}
                romanisedClassName={`mt-2 block font-normal text-violet-600 ${
                  kidsMode ? "text-center text-base" : "text-sm"
                }`}
              />
            ) : null}
            <p className={`text-violet-600 ${kidsMode ? "mt-8 text-center text-base font-bold" : "mt-6 text-sm"}`}>
              {flipped
                ? kidsMode
                  ? "Great! Tap a button below"
                  : "Swipe right = confident · left = not confident"
                : kidsMode
                  ? "Tap to hear the word!"
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
          <div className={`flex gap-2 ${kidsMode ? "gap-4" : ""}`}>
            <button
              type="button"
              onClick={() => void recordConfidence("not_confident")}
              className={`flex-1 font-semibold ${
                kidsMode
                  ? "rounded-2xl border-2 border-amber-300 bg-amber-100 px-4 py-5 text-lg text-amber-900"
                  : "rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 hover:bg-amber-100"
              }`}
            >
              {kidsMode ? "Try again" : "Not confident"}
            </button>
            <button
              type="button"
              onClick={() => void recordConfidence("confident")}
              className={`flex-1 font-semibold ${
                kidsMode
                  ? "rounded-2xl border-2 border-green-300 bg-green-100 px-4 py-5 text-lg text-green-900"
                  : "rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 hover:bg-green-100"
              }`}
            >
              {kidsMode ? "Got it!" : "Confident"}
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
  catchupReturn,
  kidsMode = false,
  onKidsComplete,
}: {
  deck: FlashcardDeckContext;
  stats: ReturnType<typeof computeDeckConfidenceStats>;
  allConfident: boolean;
  reviewMode: boolean;
  streakResult: StreakResult | null;
  onReview: () => void;
  onFinish: () => void;
  deckHubHref: string;
  catchupReturn?: string | null;
  kidsMode?: boolean;
  onKidsComplete?: () => void | Promise<void>;
}) {
  const hasNotConfident = stats.notConfident > 0;
  const kidsDoneRef = useRef(false);

  usePlaySoundOnce("game_complete");

  useEffect(() => {
    if (!kidsMode || !allConfident || kidsDoneRef.current) return;
    kidsDoneRef.current = true;
    void onKidsComplete?.();
  }, [kidsMode, allConfident, onKidsComplete]);

  return (
    <div className="flex flex-1 flex-col">
      {!kidsMode && (
      <BackLink fallbackHref={deckHubHref} className="text-sm font-medium text-violet-600 hover:text-violet-500">← Back to deck</BackLink>
      )}

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
        {allConfident ? (
          <>
            <span className="text-5xl" role="img" aria-hidden="true">
              ✓
            </span>
            <h2 className="mt-4 text-2xl font-bold text-zinc-900">
              {kidsMode ? "Amazing!" : "Set complete!"}
            </h2>
            {!kidsMode && (
            <p className="mt-2 max-w-sm text-sm text-zinc-600">
              All {stats.total} card{stats.total === 1 ? "" : "s"} confident in{" "}
              <span className="font-medium text-zinc-800">{deck.deckName}</span>.
            </p>
            )}
            {!kidsMode && streakResult?.streak_rescued && (
              <p className="mt-3 rounded-lg bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
                Streak rescued! Back to {streakResult.display_streak} day
                {streakResult.display_streak === 1 ? "" : "s"}.
              </p>
            )}
            {!kidsMode && (
            <button
              type="button"
              onClick={onFinish}
              className="mt-8 rounded-lg bg-violet-600 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-500"
            >
              Done
            </button>
            )}
            {!kidsMode && <CatchupReturnButton returnUrl={catchupReturn} />}
            {!kidsMode && deck.lessonId && deck.lessonId !== "kids" && (
              <div className="mt-6 w-full max-w-lg text-left">
                <LessonFeedbackPanel
                  lessonId={deck.lessonId}
                  title="How was this lesson?"
                  description="Quick feedback helps us improve your learning experience."
                />
              </div>
            )}
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
              <CatchupReturnButton returnUrl={catchupReturn} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
