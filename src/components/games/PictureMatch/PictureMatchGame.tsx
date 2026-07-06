"use client";

import { BackLink } from "@/components/navigation/back-link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FloatingSoundToggle } from "@/components/audio/floating-sound-toggle";
import { useAudioManager } from "@/lib/audio/audio-manager";
import { usePlaySoundOnce } from "@/lib/audio/use-play-sound";
import { createClient } from "@/lib/supabase/client";
import { shuffleArray } from "@/lib/flashcards/utils";
import { GAMES_HUB_HREF } from "@/lib/games/catalog";
import { saveGameScore } from "@/lib/games/game-scores";
import { buildGameAccuracyMetadata } from "@/lib/leaderboard/points";
import { PointsEarnedBadge } from "@/components/points/points-earned-badge";
import { SessionProgressBar } from "@/components/session-progress-bar";
import { ui } from "@/lib/ui/styles";
import { emojiForIcon } from "./emojiMap";
import {
  buildPictureMatchPool,
  type PictureMatchCard,
} from "./pictureMatchCards";

const POINTS_PER_CORRECT = 10;
const FEEDBACK_MS = 1200;

type RoundOption = {
  cardId: string;
  punjabi: string;
  romanised: string | null;
  isCorrect: boolean;
};

type Difficulty = "easy" | "medium" | "hard";

const DIFFICULTY_OPTIONS: {
  id: Difficulty;
  label: string;
  rounds: number;
  maxDifficulty: number;
}[] = [
  { id: "easy", label: "Easy", rounds: 10, maxDifficulty: 2 },
  { id: "medium", label: "Medium", rounds: 15, maxDifficulty: 3 },
  { id: "hard", label: "Hard", rounds: 20, maxDifficulty: 5 },
];

type AnswerFeedback = {
  selectedId: string;
  correctId: string;
  wasCorrect: boolean;
};

type PictureMatchGameProps = {
  initialBestScore?: number;
};

function filterPoolByDifficulty(
  pool: PictureMatchCard[],
  maxDifficulty: number
): PictureMatchCard[] {
  return pool.filter((card) => card.difficulty <= maxDifficulty);
}

function buildRoundQueue(pool: PictureMatchCard[], rounds: number): PictureMatchCard[] {
  const shuffled = shuffleArray(pool);
  const queue: PictureMatchCard[] = [];
  for (let i = 0; i < rounds; i += 1) {
    queue.push(shuffled[i % shuffled.length]);
  }
  return queue;
}

function buildRoundOptions(
  pool: PictureMatchCard[],
  correct: PictureMatchCard
): RoundOption[] {
  const distractors = shuffleArray(
    pool.filter((card) => card.punjabi !== correct.punjabi)
  ).slice(0, 3);
  const options: RoundOption[] = [
    {
      cardId: correct.id,
      punjabi: correct.punjabi,
      romanised: correct.romanised,
      isCorrect: true,
    },
    ...distractors.map((card) => ({
      cardId: card.id,
      punjabi: card.punjabi,
      romanised: card.romanised,
      isCorrect: false,
    })),
  ];
  return shuffleArray(options);
}

function PunjabiOptionLabel({
  punjabi,
  romanised,
  tone = "neutral",
}: {
  punjabi: string;
  romanised: string | null;
  tone?: "neutral" | "correct" | "wrong" | "muted";
}) {
  const latin = romanised?.trim();
  const punjabiClass =
    tone === "correct"
      ? "text-green-900"
      : tone === "wrong"
        ? "text-red-900"
        : tone === "muted"
          ? "text-zinc-400"
          : "text-zinc-900";
  const romanisedClass =
    tone === "correct"
      ? "text-green-700"
      : tone === "wrong"
        ? "text-red-700"
        : tone === "muted"
          ? "text-zinc-400"
          : "text-violet-600";

  return (
    <>
      <span className={`text-xl font-bold leading-tight ${punjabiClass}`}>{punjabi}</span>
      {latin ? (
        <span className={`mt-1 block text-base font-medium ${romanisedClass}`}>{latin}</span>
      ) : null}
    </>
  );
}

export function PictureMatchGame({ initialBestScore = 0 }: PictureMatchGameProps) {
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [allCards, setAllCards] = useState<PictureMatchCard[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [phase, setPhase] = useState<"start" | "playing" | "finished">("start");
  const [queue, setQueue] = useState<PictureMatchCard[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [result, setResult] = useState<{
    isNewBest: boolean;
    currentBest: number;
    pointsEarned: number;
  } | null>(null);

  const userIdRef = useRef<string | null>(null);
  const savedRef = useRef(false);
  const { playSound } = useAudioManager();
  const advanceTimerRef = useRef<number | null>(null);

  const difficultyConfig = useMemo(
    () => DIFFICULTY_OPTIONS.find((option) => option.id === difficulty)!,
    [difficulty]
  );

  const filteredPool = useMemo(
    () => filterPoolByDifficulty(allCards, difficultyConfig.maxDifficulty),
    [allCards, difficultyConfig.maxDifficulty]
  );

  const currentCard = queue[roundIndex];
  const totalRounds = queue.length;
  const maxScore = totalRounds * POINTS_PER_CORRECT;
  const locked = feedback !== null;
  const canStart = filteredPool.length >= 4;

  const options = useMemo(() => {
    if (!currentCard) return [];
    return buildRoundOptions(filteredPool, currentCard);
  }, [currentCard, filteredPool]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      userIdRef.current = user?.id ?? null;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current != null) {
        window.clearTimeout(advanceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadCards = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("flashcards")
        .select("id, front_text, back_text, romanised, icon_name, difficulty")
        .eq("category", "vocab");

      if (cancelled) return;

      if (error) {
        console.error("Failed to load picture match cards:", error.message);
        setLoadState("error");
        return;
      }

      const cards = buildPictureMatchPool(data ?? []);

      setAllCards(cards);
      setLoadState("ready");
    };

    void loadCards();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (phase !== "finished" || savedRef.current) return;
    savedRef.current = true;

    const persist = async () => {
      const userId = userIdRef.current;
      if (!userId) return;

      const supabase = createClient();
      const outcome = await saveGameScore(supabase, userId, "picture_match", score, {
        difficulty,
        ...buildGameAccuracyMetadata(correctCount, totalRounds),
      });
      setResult({
        isNewBest: outcome.isNewBest,
        currentBest: outcome.currentBest,
        pointsEarned: outcome.pointsEarned,
      });
    };

    void persist();
  }, [phase, score, correctCount, totalRounds, difficulty]);

  const startGame = useCallback(() => {
    if (!canStart) return;

    if (advanceTimerRef.current != null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }

    savedRef.current = false;
    const rounds = buildRoundQueue(filteredPool, difficultyConfig.rounds);
    setQueue(rounds);
    setRoundIndex(0);
    setScore(0);
    setCorrectCount(0);
    setFeedback(null);
    setCelebrate(false);
    setResult(null);
    setPhase("playing");
  }, [canStart, filteredPool, difficultyConfig.rounds]);

  const advanceRound = useCallback(() => {
    setFeedback(null);
    setCelebrate(false);

    if (roundIndex + 1 >= totalRounds) {
      setPhase("finished");
      return;
    }

    setRoundIndex((index) => index + 1);
  }, [roundIndex, totalRounds]);

  const handleAnswer = useCallback(
    (option: RoundOption) => {
      if (phase !== "playing" || !currentCard || locked) return;

      const wasCorrect = option.isCorrect;
      setFeedback({
        selectedId: option.cardId,
        correctId: currentCard.id,
        wasCorrect,
      });

      if (wasCorrect) {
        playSound("correct");
        setScore((value) => value + POINTS_PER_CORRECT);
        setCorrectCount((value) => value + 1);
        setCelebrate(true);
      }

      if (!wasCorrect) {
        playSound("incorrect");
      }

      advanceTimerRef.current = window.setTimeout(() => {
        advanceRound();
      }, FEEDBACK_MS);
    },
    [phase, currentCard, locked, advanceRound, playSound]
  );

  if (loadState === "loading") {
    return (
      <div className="space-y-4 py-8 text-center">
        <p className="text-sm text-zinc-500">Loading picture cards…</p>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600">Could not load picture cards. Please try again.</p>
        <BackLink fallbackHref={GAMES_HUB_HREF} className="text-sm font-medium text-violet-600 hover:text-violet-500">← Back to games</BackLink>
      </div>
    );
  }

  if (allCards.length < 4) {
    return (
      <div className="space-y-4">
        <BackLink fallbackHref={GAMES_HUB_HREF} className="text-sm font-medium text-violet-600 hover:text-violet-500">← Back to games</BackLink>
        <h1 className="text-2xl font-bold text-zinc-900">Picture Match</h1>
        <p className="text-sm text-zinc-500">
          Not enough vocabulary cards with pictures yet. Check back soon!
        </p>
      </div>
    );
  }

  if (phase === "start") {
    return (
      <div className="space-y-6">
        <div>
          <BackLink fallbackHref={GAMES_HUB_HREF} className="text-sm font-medium text-violet-600 hover:text-violet-500">← Back to games</BackLink>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-violet-600">
            Vocabulary game
          </p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900">Picture Match</h1>
          <p className="mt-2 text-sm text-zinc-500">What&apos;s the Punjabi word?</p>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Difficulty</p>
          <div className="flex flex-wrap gap-2">
            {DIFFICULTY_OPTIONS.map((option) => {
              const poolSize = filterPoolByDifficulty(allCards, option.maxDifficulty).length;
              const selected = difficulty === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setDifficulty(option.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    selected
                      ? "bg-violet-600 text-white"
                      : "border border-zinc-200 bg-white text-zinc-700 hover:border-violet-200 hover:bg-violet-50"
                  }`}
                >
                  {option.label}
                  <span className="ml-1.5 text-xs font-medium opacity-80">
                    · {option.rounds} rounds
                  </span>
                  {poolSize < 4 ? (
                    <span className="ml-1 text-xs font-medium text-red-500">(need 4+ cards)</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-zinc-400">
            {filteredPool.length} cards available at this difficulty
          </p>
        </div>

        {initialBestScore > 0 ? (
          <div className={ui.cardBordered}>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Your best</p>
            <p className="mt-1 text-lg font-bold text-zinc-900">{initialBestScore} points</p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={startGame}
          disabled={!canStart}
          className={`${ui.btnPrimaryBlock} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          Start
        </button>
      </div>
    );
  }

  if (phase === "finished") {
    return <PictureMatchFinishedScreen score={score} maxScore={maxScore} correctCount={correctCount} totalRounds={totalRounds} result={result} onPlayAgain={startGame} />;
  }

  return (
    <div className="relative space-y-6 pb-4">
      <FloatingSoundToggle />
      <SessionProgressBar current={roundIndex + 1} total={totalRounds} />

      <div className="flex items-center justify-between pt-2">
        <p className="text-sm font-semibold text-zinc-500">
          Round {roundIndex + 1} / {totalRounds}
        </p>
        <p
          className={`text-sm font-bold text-violet-600 transition-transform ${
            celebrate ? "scale-110" : ""
          }`}
        >
          {score} pts
        </p>
      </div>

      {currentCard ? (
        <div className="flex flex-col items-center text-center">
          <div
            className={`flex h-36 w-36 items-center justify-center rounded-3xl bg-violet-50 text-7xl shadow-inner transition-transform duration-300 ${
              celebrate ? "scale-105 animate-pulse" : ""
            }`}
            aria-hidden="true"
          >
            {emojiForIcon(currentCard.icon_name)}
          </div>
          <p className="mt-4 text-lg font-medium text-zinc-600">{currentCard.english}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const isSelected = feedback?.selectedId === option.cardId;
          const isCorrectOption = feedback?.correctId === option.cardId;
          const showCorrect = feedback !== null && isCorrectOption;
          const showWrong = feedback !== null && isSelected && !option.isCorrect;

          let buttonClass =
            "relative flex min-h-[4.5rem] flex-col items-center justify-center rounded-2xl border px-4 py-3 text-center transition-colors ";

          if (showCorrect) {
            buttonClass += "border-green-500 bg-green-50 text-green-900";
          } else if (showWrong) {
            buttonClass += "border-red-500 bg-red-50 text-red-900";
          } else if (locked) {
            buttonClass += "border-zinc-200 bg-zinc-50 text-zinc-400";
          } else {
            buttonClass +=
              "border-zinc-200 bg-white text-zinc-900 hover:border-violet-300 hover:bg-violet-50";
          }

          return (
            <button
              key={option.cardId}
              type="button"
              onClick={() => handleAnswer(option)}
              disabled={locked}
              className={buttonClass + " w-full"}
            >
              <PunjabiOptionLabel
                punjabi={option.punjabi}
                romanised={option.romanised}
                tone={
                  showCorrect ? "correct" : showWrong ? "wrong" : locked ? "muted" : "neutral"
                }
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PictureMatchFinishedScreen({
  score,
  maxScore,
  correctCount,
  totalRounds,
  result,
  onPlayAgain,
}: {
  score: number;
  maxScore: number;
  correctCount: number;
  totalRounds: number;
  result: { isNewBest: boolean; currentBest: number; pointsEarned: number } | null;
  onPlayAgain: () => void;
}) {
  usePlaySoundOnce("game_complete");

  return (
    <div className="relative space-y-6">
      <FloatingSoundToggle />
      <div className={`${ui.cardBordered} text-center`}>
        <p className="text-sm font-medium text-violet-600">Round complete</p>
        <h2 className="mt-2 text-3xl font-bold text-zinc-900">
          {score} / {maxScore}
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          {correctCount} of {totalRounds} correct
        </p>
        <PointsEarnedBadge points={result?.pointsEarned ?? 0} className="mt-3" />
        {result?.isNewBest ? (
          <p className="mt-3 text-sm font-semibold text-green-700">New personal best!</p>
        ) : null}
        {result && !result.isNewBest && result.currentBest > 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Personal best: {result.currentBest}</p>
        ) : null}
      </div>

      <button type="button" onClick={onPlayAgain} className={ui.btnPrimaryBlock}>
        Play again
      </button>
      <BackLink
        fallbackHref={GAMES_HUB_HREF}
        className="block text-center text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        Back to games
      </BackLink>
    </div>
  );
}
