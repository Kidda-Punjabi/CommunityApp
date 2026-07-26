"use client";

import { FlashcardBilingualLine } from "@/components/flashcards/flashcard-bilingual-line";
import { BackLink } from "@/components/navigation/back-link";
import { GameTutorialHost } from "@/components/games/tutorial/game-tutorial-host";
import { buildBackTextRomanisedMap } from "@/lib/chado-pauri-group/option-romanised";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChadoPauriLadder } from "@/components/games/chado-pauri-ladder";
import { PointsEarnedBadge } from "@/components/points/points-earned-badge";
import { GAMES_HUB_HREF } from "@/lib/games/catalog";
import {
  CHADO_PAURI_DISPLAY_NAME,
  CHADO_PAURI_RUNG_COUNT,
  CHADO_PAURI_RUNG_POINTS,
  LIFELINE_LABELS,
  type LifelineId,
} from "@/lib/games/chado-pauri/config";
import { buildTutorHint } from "@/lib/games/chado-pauri/hints";
import { countCardsByDifficulty } from "@/lib/games/chado-pauri/load-flashcards";
import {
  applyHalfAndHalf,
  buildChadoPauriQuestion,
} from "@/lib/games/chado-pauri/questions";
import type {
  ChadoPauriFlashcard,
  ChadoPauriOption,
  ChadoPauriQuestion,
  ChadoPauriRungResult,
} from "@/lib/games/chado-pauri/types";
import { saveGameScore } from "@/lib/games/game-scores";
import { createClient } from "@/lib/supabase/client";
import { ui } from "@/lib/ui/styles";

const FEEDBACK_MS = 1200;
const PENDING_MS = 2000;

type Phase = "ready" | "playing" | "finished";

type ChadoPauriModeProps = {
  cards: ChadoPauriFlashcard[];
  loadError: string | null;
  initialBestScore?: number;
};

export function ChadoPauriMode({
  cards,
  loadError,
  initialBestScore = 0,
}: ChadoPauriModeProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [rungIndex, setRungIndex] = useState(0);
  const [lockedInScore, setLockedInScore] = useState(0);
  const [question, setQuestion] = useState<ChadoPauriQuestion | null>(null);
  const [displayOptions, setDisplayOptions] = useState<ChadoPauriOption[]>([]);
  const [lifelinesUsed, setLifelinesUsed] = useState<Record<LifelineId, boolean>>({
    half_half: false,
    ask_tutor: false,
    skip: false,
  });
  const [lifelinesUsedThisQuestion, setLifelinesUsedThisQuestion] = useState<LifelineId[]>(
    []
  );
  const [lifelinesUsedOverall, setLifelinesUsedOverall] = useState<LifelineId[]>([]);
  const [tutorHint, setTutorHint] = useState<string | null>(null);
  const [usedFlashcardIds, setUsedFlashcardIds] = useState<Set<string>>(new Set());
  const [rungResults, setRungResults] = useState<ChadoPauriRungResult[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"pending" | "correct" | "wrong" | null>(null);
  const [fallbackCount, setFallbackCount] = useState(0);
  const [won, setWon] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);

  const advanceTimerRef = useRef<number | null>(null);
  const userIdRef = useRef<string | null>(null);
  const savedRef = useRef(false);

  const backTextRomanised = useMemo(() => buildBackTextRomanisedMap(cards), [cards]);
  const difficultyCounts = useMemo(() => countCardsByDifficulty(cards), [cards]);
  const sparseTiers = useMemo(
    () => [2, 3, 4, 5].filter((tier) => (difficultyCounts[tier] ?? 0) < 4),
    [difficultyCounts]
  );
  const canStart = cards.length >= 4 && !loadError;

  const loadQuestion = useCallback(
    (index: number, exclude: Set<string>, options?: { preserveLifelines?: boolean }) => {
      const next = buildChadoPauriQuestion(cards, index, exclude);
      if (!next) return null;

      if (next.usedDifficultyFallback) {
        setFallbackCount((count) => count + 1);
      }

      setQuestion(next);
      setDisplayOptions(next.options);
      setTutorHint(null);
      if (!options?.preserveLifelines) {
        setLifelinesUsedThisQuestion([]);
      }
      setFeedback(null);
      setSelectedAnswer(null);
      setUsedFlashcardIds((prev) => new Set(prev).add(next.flashcardId));
      return next;
    },
    [cards]
  );

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      userIdRef.current = user?.id ?? null;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) {
        window.clearTimeout(advanceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (phase !== "finished" || savedRef.current) return;
    savedRef.current = true;

    const persist = async () => {
      const userId = userIdRef.current;
      if (!userId) return;

      const correct = rungResults.filter((result) => result.correct).length;
      const supabase = createClient();
      const outcome = await saveGameScore(supabase, userId, "chado_pauri", finalScore, {
        accuracy: finalScore,
        correct,
        total: CHADO_PAURI_RUNG_COUNT,
        final_score: finalScore,
        won,
        rungs: rungResults,
        lifelines_used_overall: lifelinesUsedOverall,
        difficulty_fallbacks: fallbackCount,
      });
      setPointsEarned(outcome.pointsEarned);
      setIsNewBest(outcome.isNewBest);
    };

    void persist();
  }, [phase, rungResults, finalScore, won, lifelinesUsedOverall, fallbackCount]);

  function markLifelineUsed(id: LifelineId) {
    setLifelinesUsed((prev) => ({ ...prev, [id]: true }));
    setLifelinesUsedOverall((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setLifelinesUsedThisQuestion((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  function startGame() {
    savedRef.current = false;
    setPhase("playing");
    setRungIndex(0);
    setLockedInScore(0);
    setRungResults([]);
    setUsedFlashcardIds(new Set());
    setLifelinesUsed({ half_half: false, ask_tutor: false, skip: false });
    setLifelinesUsedOverall([]);
    setFallbackCount(0);
    setWon(false);
    setFinalScore(0);
    setPointsEarned(0);
    loadQuestion(0, new Set());
  }

  function finishGame(score: number, didWin: boolean) {
    setFinalScore(score);
    setWon(didWin);
    setPhase("finished");
  }

  function advanceAfterCorrect() {
    const rungPoints = CHADO_PAURI_RUNG_POINTS[rungIndex];
    const nextLocked = rungPoints;
    setLockedInScore(nextLocked);

    if (rungIndex + 1 >= CHADO_PAURI_RUNG_COUNT) {
      finishGame(100, true);
      return;
    }

    const nextIndex = rungIndex + 1;
    setRungIndex(nextIndex);
    loadQuestion(nextIndex, usedFlashcardIds);
  }

  function handleSelect(option: ChadoPauriOption) {
    if (!question || feedback) return;
    setSelectedAnswer(option.text);
  }

  function handleSubmit() {
    if (!question || !selectedAnswer || feedback) return;

    const option = displayOptions.find((o) => o.text === selectedAnswer);
    if (!option) return;

    setFeedback("pending");

    const isCorrect = option.isCorrect;

    const rungResult: ChadoPauriRungResult = {
      rung: rungIndex + 1,
      points: CHADO_PAURI_RUNG_POINTS[rungIndex],
      flashcard_id: question.flashcardId,
      correct: isCorrect,
      lifelines_used: [...lifelinesUsedThisQuestion],
    };

    advanceTimerRef.current = window.setTimeout(() => {
      setRungResults((prev) => [...prev, rungResult]);

      if (isCorrect) {
        setFeedback("correct");
        advanceTimerRef.current = window.setTimeout(() => {
          advanceAfterCorrect();
        }, FEEDBACK_MS);
        return;
      }

      setFeedback("wrong");
      finishGame(lockedInScore, false);
    }, PENDING_MS);
  }

  function handleHalfAndHalf() {
    if (!question || lifelinesUsed.half_half || feedback) return;
    markLifelineUsed("half_half");
    setDisplayOptions(applyHalfAndHalf(question.options));
  }

  function handleAskTutor() {
    if (!question || lifelinesUsed.ask_tutor || feedback) return;
    markLifelineUsed("ask_tutor");
    setTutorHint(buildTutorHint(question));
  }

  function handleSkip() {
    if (!question || lifelinesUsed.skip || feedback) return;
    markLifelineUsed("skip");
    const exclude = new Set(usedFlashcardIds);
    exclude.add(question.flashcardId);
    loadQuestion(rungIndex, exclude, { preserveLifelines: true });
  }

  if (phase === "ready") {
    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-start justify-between gap-3">
            <BackLink fallbackHref={GAMES_HUB_HREF}>← Back</BackLink>
            <GameTutorialHost tutorialId="chado_pauri" />
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-violet-600">
            Solo ladder
          </p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900">{CHADO_PAURI_DISPLAY_NAME}</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Climb nine rungs of multiple-choice questions. One wrong answer ends the run — your
            score is the last rung you locked in.
          </p>
        </div>

        {loadError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Could not load flashcards: {loadError}
          </p>
        ) : null}

        {sparseTiers.length > 0 && canStart ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Higher rungs target difficulty tiers {sparseTiers.join(", ")}, but those pools are
            sparse in the database right now — the game will use the nearest available tier
            instead.
          </p>
        ) : null}

        {!canStart && !loadError ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Need at least 4 flashcards to play. Add more cards in admin.
          </p>
        ) : null}

        {initialBestScore > 0 ? (
          <p className="text-sm text-zinc-500">
            Personal best: <span className="font-semibold text-zinc-800">{initialBestScore}</span>{" "}
            pts
          </p>
        ) : null}

        <button
          type="button"
          onClick={startGame}
          disabled={!canStart}
          className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
        >
          Start climb
        </button>
      </div>
    );
  }

  if (phase === "finished") {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-violet-600">
            {won ? "You reached the top!" : "Run over"}
          </p>
          <h2 className="mt-2 text-3xl font-bold tabular-nums text-zinc-900">{finalScore}</h2>
          <p className="mt-1 text-sm text-zinc-500">points locked in</p>
          {isNewBest ? (
            <p className="mt-2 text-sm font-semibold text-green-700">New personal best!</p>
          ) : null}
          <PointsEarnedBadge points={pointsEarned} className="mt-4 justify-center" />
        </div>

        {!won && question ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
            <p className="font-medium text-zinc-900">The correct answer was:</p>
            <p className="mt-1 text-zinc-700">{question.correctAnswer}</p>
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setPhase("ready")}
            className={ui.btnPrimaryBlock}
          >
            Play again
          </button>
          <BackLink fallbackHref={GAMES_HUB_HREF} className="block text-center text-sm font-medium text-violet-600 hover:text-violet-500">
            ← Back
          </BackLink>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <BackLink fallbackHref={GAMES_HUB_HREF}>← Back</BackLink>
        <p className="text-sm font-semibold text-zinc-900">
          Rung {rungIndex + 1} · {CHADO_PAURI_RUNG_POINTS[rungIndex]} pts
        </p>
      </div>

      <ChadoPauriLadder currentRungIndex={rungIndex} lockedInScore={lockedInScore} />

      {question ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Prompt</p>
          <p className="mt-2 text-lg font-medium text-zinc-900">{question.prompt}</p>
        </div>
      ) : null}

      {tutorHint ? (
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            Tutor hint
          </p>
          <p className="mt-1">{tutorHint}</p>
        </div>
      ) : null}

      {feedback === "pending" ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-800">
          Checking…
        </p>
      ) : null}

      {feedback === "correct" ? (
        <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-center text-sm font-medium text-green-800">
          Correct — climbing to the next rung…
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-2">
        {displayOptions.map((option) => {
          const isSelected = selectedAnswer === option.text;
          const showCorrect = feedback === "correct" && option.isCorrect;
          const showWrong = feedback === "wrong" && isSelected && !option.isCorrect;
          const showPending = feedback === "pending" && isSelected;

          return (
            <button
              key={option.key}
              type="button"
              disabled={Boolean(feedback)}
              onClick={() => handleSelect(option)}
              className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                showCorrect
                  ? "border-green-300 bg-green-50 text-green-900"
                  : showWrong
                    ? "border-red-300 bg-red-50 text-red-900"
                    : showPending
                      ? "border-amber-400 bg-amber-50 text-amber-950"
                      : isSelected
                        ? "border-2 border-violet-600 bg-violet-50 text-violet-900"
                        : "border-zinc-200 bg-white text-zinc-800 hover:border-violet-200 hover:bg-violet-50/50"
              }`}
            >
              <FlashcardBilingualLine
                text={option.text}
                romanised={backTextRomanised[option.text.trim()] ?? null}
              />
            </button>
          );
        })}
      </div>

      {!feedback ? (
        <button
          type="button"
          disabled={!selectedAnswer}
          onClick={handleSubmit}
          className={ui.btnPrimaryBlock}
        >
          Submit answer
        </button>
      ) : null}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {(Object.keys(LIFELINE_LABELS) as LifelineId[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              if (id === "half_half") handleHalfAndHalf();
              else if (id === "ask_tutor") handleAskTutor();
              else handleSkip();
            }}
            disabled={lifelinesUsed[id] || Boolean(feedback)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
          >
            {LIFELINE_LABELS[id]}
          </button>
        ))}
      </div>
    </div>
  );
}
