"use client";

import { BackLink } from "@/components/navigation/back-link";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FloatingSoundToggle } from "@/components/audio/floating-sound-toggle";
import { useAudioManager } from "@/lib/audio/audio-manager";
import { usePlaySoundOnce } from "@/lib/audio/use-play-sound";
import { createClient } from "@/lib/supabase/client";
import { FlashcardBilingualLine } from "@/components/flashcards/flashcard-bilingual-line";
import type { FlashcardDeckCard, FlashcardDeckContext } from "@/lib/flashcards/types";
import { pickRandomItems, shuffleArray } from "@/lib/flashcards/utils";
import { shuffleSeeded } from "@/lib/challenges/seeded-random";
import { saveGameScoreIfBest } from "@/lib/games/game-scores";
import { buildGameAccuracyMetadata } from "@/lib/leaderboard/points";
import { PointsEarnedBadge } from "@/components/points/points-earned-badge";
import { ChallengeModeBanner } from "@/components/challenges/challenge-mode-banner";
import { ChallengePostGameBanner } from "@/components/challenges/challenge-post-game-banner";
import { SessionProgressBar } from "@/components/session-progress-bar";
import { useChallengeFinish } from "@/lib/challenges/use-challenge-finish";
import type { ChallengePlayContext } from "@/lib/challenges/types";

const LIVES = 3;
const OPTIONS = 4;
const FAST_MS = 2500;
const MEDIUM_MS = 5000;

function pointsForCorrectAnswer(elapsedMs: number): number {
  if (elapsedMs <= FAST_MS) return 15;
  if (elapsedMs <= MEDIUM_MS) return 12;
  if (elapsedMs <= 8000) return 10;
  return 8;
}

function romanisedForDeckText(cards: FlashcardDeckCard[], text: string): string | null {
  const card = cards.find((c) => c.front_text === text || c.back_text === text);
  return card?.romanised ?? null;
}

type SpeedTranslateModeProps = {
  deck: FlashcardDeckContext;
  initialBestScore: number;
  challenge?: ChallengePlayContext | null;
};

export function SpeedTranslateMode({
  deck,
  initialBestScore,
  challenge = null,
}: SpeedTranslateModeProps) {
  const backHref = `/dashboard/games/speed-translate`;

  const [phase, setPhase] = useState<"ready" | "playing" | "finished">("ready");
  const [queue, setQueue] = useState<typeof deck.cards>([]);
  const [index, setIndex] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [result, setResult] = useState<{
    isNewBest: boolean;
    currentBest: number;
    pointsEarned: number;
  } | null>(null);

  const userIdRef = useRef<string | null>(null);
  const savedRef = useRef(false);
  const answeredRef = useRef(0);
  const correctCountRef = useRef(0);
  const questionShownAtRef = useRef(Date.now());
  const { playSound } = useAudioManager();

  const currentCard = queue[index];

  const challengeFinish = useChallengeFinish({
    challengeId: challenge?.id,
    score,
    scoreMetadata: {
      deck_name: deck.deckName,
      ...buildGameAccuracyMetadata(correctCountRef.current, answeredRef.current),
    },
    enabled: phase === "finished" && Boolean(challenge),
  });

  useEffect(() => {
    if (challenge && phase === "ready") startGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge?.id]);

  const options = useMemo(() => {
    if (!currentCard) return [];
    const distractors = pickRandomItems(
      deck.cards.map((c) => c.back_text),
      OPTIONS - 1,
      currentCard.back_text
    );
    return shuffleArray([currentCard.back_text, ...distractors]);
  }, [currentCard, deck.cards]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      userIdRef.current = user?.id ?? null;
    });
  }, []);

  useEffect(() => {
    if (phase === "playing") {
      questionShownAtRef.current = Date.now();
    }
  }, [phase, index]);

  useEffect(() => {
    if (phase !== "finished" || savedRef.current) return;
    savedRef.current = true;

    const persist = async () => {
      const userId = userIdRef.current;
      if (!userId) return;

      const supabase = createClient();
      const outcome = await saveGameScoreIfBest(
        supabase,
        userId,
        "speed_translate",
        score,
        {
          deck_name: deck.deckName,
          ...buildGameAccuracyMetadata(correctCountRef.current, answeredRef.current),
        }
      );
      setResult({
        isNewBest: outcome.isNewBest,
        currentBest: outcome.currentBest,
        pointsEarned: outcome.pointsEarned,
      });
    };

    void persist();
  }, [phase, score, deck.deckName]);

  function startGame() {
    savedRef.current = false;
    answeredRef.current = 0;
    correctCountRef.current = 0;
    setQueue(
      challenge?.config.seed != null
        ? shuffleSeeded(deck.cards, challenge.config.seed)
        : shuffleArray(deck.cards)
    );
    setIndex(0);
    setLives(LIVES);
    setScore(0);
    setCorrectCount(0);
    setResult(null);
    setPhase("playing");
  }

  function endGame() {
    setPhase("finished");
  }

  function handleAnswer(answer: string) {
    if (phase !== "playing" || !currentCard) return;

    answeredRef.current += 1;

    if (answer === currentCard.back_text) {
      playSound("correct");
      const elapsed = Date.now() - questionShownAtRef.current;
      const points = pointsForCorrectAnswer(elapsed);
      const nextScore = score + points;
      setCorrectCount((count) => count + 1);
      correctCountRef.current += 1;
      setScore(nextScore);
      if (index + 1 >= queue.length) {
        setScore(nextScore);
        endGame();
        return;
      }
      setIndex((i) => i + 1);
      return;
    }

    playSound("incorrect");
    const nextLives = lives - 1;
    setLives(nextLives);
    if (nextLives <= 0) {
      endGame();
      return;
    }
    if (index + 1 >= queue.length) {
      endGame();
      return;
    }
    setIndex((i) => i + 1);
  }

  if (phase === "ready" && !challenge) {
    return (
      <div className="space-y-6">
        <div>
          <BackLink fallbackHref={backHref} className="text-sm font-medium text-violet-600 hover:text-violet-500">← Back to decks</BackLink>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-violet-600">
            Translation Sprint · {deck.deckName}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900">{deck.lessonTitle}</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Pick the correct translation. Faster correct answers score more points. You have{" "}
            {LIVES} lives.
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Your best</p>
          <p className="mt-1 text-lg font-bold text-zinc-900">
            {initialBestScore > 0 ? `${initialBestScore} correct` : "No score yet"}
          </p>
        </div>
        <button
          type="button"
          onClick={startGame}
          className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
        >
          Start game
        </button>
      </div>
    );
  }

  if (phase === "finished") {
    return <SpeedTranslateFinishedScreen challenge={challenge} challengeFinish={challengeFinish} score={score} result={result} backHref={backHref} onPlayAgain={startGame} />;
  }

  return (
    <div className="relative space-y-6">
      <FloatingSoundToggle />
      <SessionProgressBar current={index + 1} total={queue.length} />
      {challenge && <ChallengeModeBanner challenge={challenge} gameType="speed_translate" />}
      <div className="flex items-center justify-between gap-3">
        <BackLink fallbackHref={backHref} className="text-sm font-medium text-violet-600 hover:text-violet-500">← Exit</BackLink>
        <p className="text-sm font-semibold text-zinc-900">
          {score} pts · {"❤️".repeat(lives)}
          {"🖤".repeat(LIVES - lives)}
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Translate</p>
        <div className="mt-3 text-2xl">
          <FlashcardBilingualLine
            text={currentCard?.front_text ?? ""}
            romanised={currentCard ? romanisedForDeckText(deck.cards, currentCard.front_text) : null}
            gurmukhiClassName="text-2xl font-bold text-zinc-900"
          />
        </div>
      </div>

      <div className="grid gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => handleAnswer(option)}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left text-sm hover:border-violet-300 hover:bg-violet-50"
          >
            <FlashcardBilingualLine
              text={option}
              romanised={romanisedForDeckText(deck.cards, option)}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function SpeedTranslateFinishedScreen({
  challenge,
  challengeFinish,
  score,
  result,
  backHref,
  onPlayAgain,
}: {
  challenge: ChallengePlayContext | null;
  challengeFinish: ReturnType<typeof useChallengeFinish>;
  score: number;
  result: { isNewBest: boolean; currentBest: number; pointsEarned: number } | null;
  backHref: string;
  onPlayAgain: () => void;
}) {
  usePlaySoundOnce("game_complete");

  return (
    <div className="relative space-y-6">
      <FloatingSoundToggle />
      {challenge && (
        <ChallengePostGameBanner
          opponentName={challenge.opponentDisplayName}
          result={challengeFinish.result}
          error={challengeFinish.error}
          submitting={challengeFinish.submitting}
        />
      )}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-medium text-violet-600">Game over</p>
        <h2 className="mt-2 text-2xl font-bold text-zinc-900">{score} points</h2>
        <PointsEarnedBadge points={result?.pointsEarned ?? 0} className="mt-3" />
        {result?.isNewBest && (
          <p className="mt-3 text-sm font-semibold text-green-700">New personal best!</p>
        )}
        {result && !result.isNewBest && result.currentBest > 0 && (
          <p className="mt-3 text-sm text-zinc-500">Personal best: {result.currentBest}</p>
        )}
      </div>
      {!challenge && (
        <button
          type="button"
          onClick={onPlayAgain}
          className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
        >
          Play again
        </button>
      )}
      <BackLink
        fallbackHref={backHref}
        className="block text-center text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        Back to decks
      </BackLink>
    </div>
  );
}
