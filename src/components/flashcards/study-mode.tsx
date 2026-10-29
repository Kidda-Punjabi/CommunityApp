"use client";

import { emojiForIcon } from "@/components/games/PictureMatch/emojiMap";
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
import {
  FLASHCARD_CARD_TYPE_LABELS,
  type FlashcardCardType,
  type FlashcardDeckCard,
  type FlashcardDeckContext,
} from "@/lib/flashcards/types";
import { SwipeCard, type SwipeCardHandle } from "@/components/flashcards/swipe-card";
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
import { RoomActivityHandoff } from "@/components/community/room-activity-handoff";

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
  const swipeRef = useRef<SwipeCardHandle | null>(null);
  const [hintDismissed, setHintDismissed] = useState(false);
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

  const ratingLock = useRef(false);

  async function recordConfidence(confidence: FlashcardConfidence) {
    if (!card || ratingLock.current) return;
    ratingLock.current = true;
    window.setTimeout(() => {
      ratingLock.current = false;
    }, 350);

    playSound(confidence === "confident" ? "correct" : "incorrect");

    const cardId = card.id;
    const userId = userIdRef.current;
    setProgressMap((prev) => {
      const next = new Map(prev);
      next.set(cardId, { flashcard_id: cardId, confidence });
      return next;
    });
    if (index < orderedCards.length - 1) {
      setIndex((prev) => prev + 1);
      setFlipped(false);
    } else {
      setPhase("summary");
    }

    if (!userId) return;
    const supabase = createClient();
    try {
      const result = await saveFlashcardConfidence(supabase, userId, cardId, confidence);
      if (!kidsMode) {
        sumPointsEarned([result.flashcardPoints, result.lessonBonus]);
      }
    } catch (error) {
      console.error("Failed to save flashcard confidence:", error);
    }
  }

  function goPrev() {
    setIndex((prev) => Math.max(prev - 1, 0));
    setFlipped(false);
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
      <>
      <RoomActivityHandoff done />
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
      </>
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

  const cardType: FlashcardCardType = card.card_type ?? "word";
  const isSpeak = cardType === "speak";
  const isQuestion = cardType === "question";
  const leftLabel = kidsMode ? "Try again" : isSpeak || isQuestion ? "Skip" : "Not yet";
  const rightLabel = kidsMode ? "Got it!" : isSpeak ? "Done" : isQuestion ? "Answered" : "Confident";
  const showHint = !kidsMode && index === 0 && !hintDismissed && !reviewMode;
  // Kids see only the picture on the front, as before.
  const frontLine = kidsMode ? { text: "", romanised: null } : studyCardLine(card, promptText);
  const backLine = studyCardLine(card, answerText);

  function rate(direction: "left" | "right") {
    setHintDismissed(true);
    void recordConfidence(direction === "right" ? "confident" : "not_confident");
  }

  return (
    <div className="relative flex min-h-[calc(100dvh-7rem)] flex-1 flex-col gap-3 font-[family-name:var(--font-community)]">
      {!kidsMode && <FloatingSoundToggle />}
      <div className="flex items-center gap-3">
        <BackLink
          fallbackHref={deckHubHref}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white text-lg font-bold text-[#1F1640] hover:text-[#1F1640]"
        >
          <span aria-hidden="true">←</span>
          <span className="sr-only">Back to deck</span>
        </BackLink>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#E4DFEE]">
          <div
            className="h-full rounded-full bg-[#5B21B6] transition-[width] duration-300"
            style={{ width: `${Math.round(((index + 1) / Math.max(1, orderedCards.length)) * 100)}%` }}
          />
        </div>
        <span className="text-[15px] font-bold tabular-nums text-[#4A3F66]">
          {index + 1} / {orderedCards.length}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex h-8 items-center rounded-full bg-[#EDE6FF] px-3 text-[13px] font-bold uppercase tracking-wide text-[#3B1A8C]">
          {FLASHCARD_CARD_TYPE_LABELS[cardType]}
          {reviewMode ? " · Review" : ""}
        </span>
        <span className="truncate text-sm font-medium text-[#6B5F8A]">
          {fullStats.confident} confident · {fullStats.notConfident} not yet
        </span>
      </div>

      {!kidsMode && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShuffled((prev) => !prev)}
            className={`h-9 rounded-full px-3 text-xs font-bold ${
              shuffled ? "bg-[#5B21B6] text-white" : "bg-white text-[#4A3F66]"
            }`}
          >
            Shuffle {shuffled ? "on" : "off"}
          </button>
          {!isSpeak ? (
            <button
              type="button"
              onClick={() => setShowBackFirst((prev) => !prev)}
              className={`h-9 rounded-full px-3 text-xs font-bold ${
                showBackFirst ? "bg-[#5B21B6] text-white" : "bg-white text-[#4A3F66]"
              }`}
            >
              {showBackFirst ? "Punjabi first" : "English first"}
            </button>
          ) : null}
          {index > 0 ? (
            <button type="button" onClick={goPrev} className="h-9 rounded-full bg-white px-3 text-xs font-bold text-[#4A3F66]">
              Previous card
            </button>
          ) : null}
        </div>
      )}

      <div className="relative mx-auto mt-1 w-full max-w-lg flex-1 tab:max-w-[680px]" style={{ minHeight: 380 }}>
        {orderedCards.length - index > 2 ? (
          <div aria-hidden="true" className="absolute inset-x-[22px] bottom-[-14px] top-[22px] rounded-[28px] bg-[#E4DCF7]" />
        ) : null}
        {orderedCards.length - index > 1 ? (
          <div aria-hidden="true" className="absolute inset-x-[11px] bottom-[-7px] top-[11px] rounded-[28px] bg-[#EEE8FB]" />
        ) : null}
        <div key={card.id} className="flashcard-rise absolute inset-0">
          <SwipeCard
            ref={swipeRef}
            flipped={flipped}
            canFlip
            onFlip={() => {
              setHintDismissed(true);
              setFlipped((prev) => !prev);
            }}
            onSwiped={rate}
            leftStamp={leftLabel.toUpperCase()}
            rightStamp={rightLabel.toUpperCase()}
            front={
              <CardFace
                label={frontLabel(cardType, showBackFirst)}
                line={frontLine}
                icon={kidsMode && card.icon_name ? emojiForIcon(card.icon_name) : null}
                footer={
                  isSpeak ? (
                    <span className="flex flex-col items-center gap-2">
                      <SpeakTimer key={card.id} />
                      <span>Tap the card for helper words</span>
                    </span>
                  ) : kidsMode ? (
                    "Tap to see the word!"
                  ) : (
                    "Tap to flip"
                  )
                }
              />
            }
            back={
              <CardFace
                label={isQuestion ? "Example answer" : isSpeak ? "Helper words" : promptText}
                labelIsPrompt={!isQuestion && !isSpeak}
                line={backLine}
                example={
                  (cardType === "word" || isSpeak) && card.example_sentence_gurmukhi
                    ? {
                        label: isSpeak ? "Start like this" : "In a sentence",
                        gurmukhi: card.example_sentence_gurmukhi,
                        romanised: card.example_sentence_romanised ?? null,
                        english: card.example_sentence_english ?? null,
                      }
                    : null
                }
                footer={cardProgress ? `Last time: ${cardProgress.confidence === "confident" ? rightLabel : leftLabel}` : "Swipe or tap a button"}
              />
            }
            overlay={
              showHint ? (
                <button
                  type="button"
                  onClick={() => setHintDismissed(true)}
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 rounded-[28px] bg-[#1F1640]/80 p-6 text-white"
                >
                  <span className="font-heading text-[22px] font-bold leading-tight">Swipe to rate each card</span>
                  <span className="grid w-full grid-cols-2 gap-3">
                    <span className="flex flex-col items-center gap-1 rounded-[18px] bg-orange-100 px-2 py-3 text-orange-800">
                      <span className="text-2xl font-extrabold leading-none">←</span>
                      <span className="text-[15px] font-bold">{leftLabel}</span>
                    </span>
                    <span className="flex flex-col items-center gap-1 rounded-[18px] bg-teal-100 px-2 py-3 text-teal-800">
                      <span className="text-2xl font-extrabold leading-none">→</span>
                      <span className="text-[15px] font-bold">{rightLabel}</span>
                    </span>
                  </span>
                  <span className="text-sm text-violet-200">Or use the buttons below. Tap to start.</span>
                </button>
              ) : null
            }
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => swipeRef.current?.fling("left")}
          className="h-14 rounded-[18px] bg-orange-100 text-base font-bold text-orange-800 active:scale-[0.98]"
        >
          ← {leftLabel}
        </button>
        <button
          type="button"
          onClick={() => swipeRef.current?.fling("right")}
          className="h-14 rounded-[18px] bg-teal-700 text-base font-bold text-white active:scale-[0.98]"
        >
          {rightLabel} →
        </button>
      </div>
    </div>
  );
}

function frontLabel(type: FlashcardCardType, punjabiFirst: boolean): string {
  if (punjabiFirst) return "What does it mean?";
  if (type === "sentence") return "Say the whole sentence";
  if (type === "question") return "Answer out loud";
  if (type === "speak") return "Talk for 60 seconds";
  return "Say it in Punjabi";
}

const GURMUKHI_TEXT = /[\u0A00-\u0A7F]/;

/** Big, centred text that shrinks for long sentences so it always fits the card. */
function sizeFor(text: string): string {
  const length = [...text].length;
  if (length <= 14) return "text-[44px] leading-[1.15]";
  if (length <= 28) return "text-[34px] leading-[1.2]";
  if (length <= 60) return "text-[26px] leading-[1.3]";
  return "text-[21px] leading-[1.35]";
}

function CardFace({
  label,
  labelIsPrompt = false,
  line,
  icon = null,
  example = null,
  footer,
}: {
  label: string;
  labelIsPrompt?: boolean;
  line: { text: string; romanised: string | null };
  icon?: string | null;
  example?: { label: string; gurmukhi: string; romanised: string | null; english: string | null } | null;
  footer: React.ReactNode;
}) {
  const gurmukhi = GURMUKHI_TEXT.test(line.text);
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 pb-14 pt-12 text-center text-[#1F1640]">
      <span
        className={`absolute top-6 px-6 ${
          labelIsPrompt ? "text-[15px] font-medium text-[#6B5F8A]" : "text-[13px] font-bold uppercase tracking-[0.08em] text-[#6B5F8A]"
        }`}
      >
        {label}
      </span>
      {icon ? (
        <span className="mb-3 text-6xl" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span
        className={`${sizeFor(line.text)} font-bold ${
          gurmukhi ? "font-[family-name:var(--font-gurmukhi)]" : "font-heading"
        }`}
      >
        {line.text}
      </span>
      {line.romanised && gurmukhi ? (
        <span className="mt-2 text-xl font-medium text-[#5B21B6]">{line.romanised}</span>
      ) : null}
      {example ? (
        <span className="mt-6 flex w-full flex-col items-center gap-1 rounded-[18px] bg-[#F7F5FC] px-4 py-3 text-center">
          <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#6B5F8A]">{example.label}</span>
          <span className="font-[family-name:var(--font-gurmukhi)] text-lg font-medium">{example.gurmukhi}</span>
          {example.romanised || example.english ? (
            <span className="text-sm text-[#4A3F66]">
              {[example.romanised, example.english].filter(Boolean).join(" · ")}
            </span>
          ) : null}
        </span>
      ) : null}
      <span className="absolute bottom-5 text-sm font-medium text-[#6B5F8A]">{footer}</span>
    </div>
  );
}

/** "Speak about" cards: a 60 second talk timer, started by tapping. */
function SpeakTimer() {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (endsAt == null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [endsAt]);
  if (endsAt == null) {
    return (
      <span
        role="button"
        tabIndex={0}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={(event) => {
          event.stopPropagation();
          setEndsAt(Date.now() + 60_000);
          setNow(Date.now());
        }}
        className="inline-flex h-10 items-center rounded-full bg-[#5B21B6] px-4 text-sm font-bold text-white"
      >
        Start 60s timer
      </span>
    );
  }
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  return <span className="text-base font-bold tabular-nums text-[#5B21B6]">{left > 0 ? `${left}s left` : "Time's up!"}</span>;
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
