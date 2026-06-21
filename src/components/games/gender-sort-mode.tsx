"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { GenderedNoun } from "@/lib/games/types";
import { GameSessionReview } from "@/components/games/game-session-review";
import { GameSessionSettings } from "@/components/games/game-session-settings";
import { GAMES_HUB_HREF } from "@/lib/games/catalog";
import { saveGameScore } from "@/lib/games/game-scores";
import {
  buildGenderSortAdjectiveLogEntry,
  buildGenderSortNounLogEntry,
  genderLabel,
} from "@/lib/games/session-review-builders";
import type { RoundResult } from "@/lib/games/session-review";
import {
  buildAdjectiveAgreementQuestion,
  filterNounsByCategory,
  nounCategoryTags,
  type AdjectiveAgreementQuestion,
} from "@/lib/games/gender-sort-adjectives";
import { pickCycledPool, type GameSessionSettingsChoice } from "@/lib/games/session-settings";
import { pickCycledPoolSeeded } from "@/lib/challenges/seeded-random";
import { ChallengeModeBanner } from "@/components/challenges/challenge-mode-banner";
import { ChallengePostGameBanner } from "@/components/challenges/challenge-post-game-banner";
import { SessionProgressBar } from "@/components/session-progress-bar";
import { useChallengeFinish } from "@/lib/challenges/use-challenge-finish";
import type { ChallengePlayContext } from "@/lib/challenges/types";
import { ui } from "@/lib/ui/styles";

const BASE_POINTS = 10;
const SPEED_BONUS_MS = 3000;
const FEEDBACK_MS = 1100;

type SortMode = "nouns" | "adjectives";

type GenderSortModeProps = {
  nouns: GenderedNoun[];
  initialBestScore: number;
  challenge?: ChallengePlayContext | null;
};

type AdjectiveFeedback = {
  correct: boolean;
  selected: string;
};

type AnswerFeedback = {
  correct: boolean;
  chosen: "masculine" | "feminine";
  actual: "masculine" | "feminine";
  points: number;
};

function NounPromptDisplay({
  punjabi,
  romanised,
  english,
}: {
  punjabi: string;
  romanised: string | null;
  english: string;
}) {
  const latin = romanised?.trim();

  return (
    <div className="space-y-1.5 text-center">
      <p className="text-3xl font-bold leading-tight text-zinc-900">{punjabi}</p>
      {latin ? (
        <p className="text-2xl font-semibold leading-tight text-violet-600">{latin}</p>
      ) : null}
      <p className={`text-sm text-zinc-500 ${latin ? "pt-1" : "pt-2"}`}>{english}</p>
    </div>
  );
}

function PunjabiOptionLabel({
  punjabi,
  romanised,
  label,
  centered = false,
}: {
  punjabi: string;
  romanised: string;
  label?: string;
  centered?: boolean;
}) {
  const latin = romanised.trim();

  return (
    <span className={centered ? "flex w-full flex-col items-center text-center" : "block"}>
      <span className="text-lg font-semibold text-zinc-900">{punjabi}</span>
      {latin ? (
        <span className="mt-0.5 block text-lg font-medium text-violet-600">{latin}</span>
      ) : null}
      {label ? (
        <span className="mt-0.5 block text-xs text-zinc-400">{label}</span>
      ) : null}
    </span>
  );
}

export function GenderSortMode({
  nouns,
  initialBestScore,
  challenge = null,
}: GenderSortModeProps) {
  const gamesHubHref = GAMES_HUB_HREF;
  const filterOptions = useMemo(() => nounCategoryTags(nouns), [nouns]);

  const [sortMode, setSortMode] = useState<SortMode>("nouns");
  const [phase, setPhase] = useState<"ready" | "playing" | "finished">("ready");
  const [queue, setQueue] = useState<GenderedNoun[]>([]);
  const [adjectiveQueue, setAdjectiveQueue] = useState<AdjectiveAgreementQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [shownAt, setShownAt] = useState<number>(Date.now());
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [adjectiveFeedback, setAdjectiveFeedback] = useState<AdjectiveFeedback | null>(null);
  const [sessionLog, setSessionLog] = useState<RoundResult[]>([]);
  const [result, setResult] = useState<{
    isNewBest: boolean;
    currentBest: number;
    pointsEarned: number;
  } | null>(null);

  const userIdRef = useRef<string | null>(null);
  const savedRef = useRef(false);
  const advanceTimerRef = useRef<number | null>(null);

  const current = queue[index];
  const adjectiveQuestion = adjectiveQueue[index];
  const locked = feedback !== null || adjectiveFeedback !== null;
  const totalQuestionsCount = sessionLog.length || queue.length || adjectiveQueue.length;
  const accuracyPct =
    totalQuestionsCount > 0 ? Math.round((correct / totalQuestionsCount) * 100) : 0;

  const challengeFinish = useChallengeFinish({
    challengeId: challenge?.id,
    score,
    scoreMetadata: {
      accuracy: accuracyPct,
      correct,
      total: totalQuestionsCount,
      sessionLog,
    },
    enabled: phase === "finished" && Boolean(challenge),
  });

  const poolSizeForFilter = useCallback(
    (filterIds: string[]) =>
      filterNounsByCategory(nouns, filterIds[0] ?? "all").length,
    [nouns]
  );

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
    if (phase !== "finished" || savedRef.current) return;
    savedRef.current = true;

    const totalQuestions = sessionLog.length || queue.length || adjectiveQueue.length;
    const accuracy = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0;

    const persist = async () => {
      const userId = userIdRef.current;
      if (!userId) return;

      const supabase = createClient();
      const outcome = await saveGameScore(supabase, userId, "gender_sort", score, {
        accuracy,
        correct,
        total: totalQuestions,
        sessionLog,
      });
      setResult({
        isNewBest: outcome.isNewBest,
        currentBest: outcome.currentBest,
        pointsEarned: outcome.pointsEarned,
      });
    };

    void persist();
  }, [phase, score, correct, sessionLog, queue.length, adjectiveQueue.length]);

  function startGame(choice: GameSessionSettingsChoice) {
    if (advanceTimerRef.current != null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    savedRef.current = false;
    setFeedback(null);
    setAdjectiveFeedback(null);
    setIndex(0);
    setScore(0);
    setCorrect(0);
    setSessionLog([]);
    setResult(null);

    const pool = filterNounsByCategory(nouns, choice.filterIds[0] ?? "all");
    const selected =
      challenge?.config.seed != null
        ? pickCycledPoolSeeded(pool, choice.questionCount, challenge.config.seed)
        : pickCycledPool(pool, choice.questionCount);

    if (sortMode === "adjectives") {
      setAdjectiveQueue(
        selected.map((noun) =>
          buildAdjectiveAgreementQuestion(
            noun.gender,
            noun.topic_tags.some((tag) => tag.toLowerCase() === "plural") ? "plural" : "singular",
            noun.english_meaning
          )
        )
      );
      setQueue([]);
    } else {
      setQueue(selected);
      setAdjectiveQueue([]);
    }

    setShownAt(Date.now());
    setPhase("playing");
  }

  function advanceAfterNoun(nextScore: number, nextCorrect: number) {
    setFeedback(null);
    if (index + 1 >= queue.length) {
      finishGame(nextScore, nextCorrect);
      return;
    }
    setScore(nextScore);
    setCorrect(nextCorrect);
    setIndex((i) => i + 1);
    setShownAt(Date.now());
  }

  function advanceAfterAdjective(nextScore: number, nextCorrect: number) {
    setAdjectiveFeedback(null);
    if (index + 1 >= adjectiveQueue.length) {
      finishGame(nextScore, nextCorrect);
      return;
    }
    setScore(nextScore);
    setCorrect(nextCorrect);
    setIndex((i) => i + 1);
  }

  function handleAdjectiveAnswer(option: string) {
    if (phase !== "playing" || !adjectiveQuestion || adjectiveFeedback) return;

    const isCorrect = option === adjectiveQuestion.correctAnswer;
    const points = isCorrect ? BASE_POINTS : 0;
    setSessionLog((prev) => [
      ...prev,
      buildGenderSortAdjectiveLogEntry(adjectiveQuestion, option, isCorrect),
    ]);
    setAdjectiveFeedback({ correct: isCorrect, selected: option });

    const nextScore = score + points;
    const nextCorrect = correct + (isCorrect ? 1 : 0);

    if (isCorrect) {
      advanceTimerRef.current = window.setTimeout(() => {
        advanceAfterAdjective(nextScore, nextCorrect);
      }, FEEDBACK_MS);
    }
  }

  function handleContinueAfterWrongAdjective() {
    if (!adjectiveFeedback || adjectiveFeedback.correct) return;

    const nextScore = score;
    const nextCorrect = correct;
    advanceAfterAdjective(nextScore, nextCorrect);
  }

  function finishGame(finalScore: number, finalCorrect: number) {
    setScore(finalScore);
    setCorrect(finalCorrect);
    setPhase("finished");
  }

  function handleSort(guess: "masculine" | "feminine") {
    if (phase !== "playing" || !current || locked) return;

    const elapsed = Date.now() - shownAt;
    const isCorrect = guess === current.gender;
    const speedBonus = isCorrect && elapsed < SPEED_BONUS_MS ? 5 : 0;
    const points = isCorrect ? BASE_POINTS + speedBonus : 0;
    const nextScore = score + points;
    const nextCorrect = correct + (isCorrect ? 1 : 0);

    setSessionLog((prev) => [
      ...prev,
      buildGenderSortNounLogEntry(current, guess, isCorrect),
    ]);

    setFeedback({
      correct: isCorrect,
      chosen: guess,
      actual: current.gender,
      points,
    });

    if (isCorrect) {
      advanceTimerRef.current = window.setTimeout(() => {
        advanceAfterNoun(nextScore, nextCorrect);
      }, FEEDBACK_MS);
    }
  }

  function handleContinueAfterWrongNoun() {
    if (!feedback || feedback.correct) return;
    advanceAfterNoun(score, correct);
  }

  useEffect(() => {
    if (challenge?.config.session && phase === "ready" && nouns.length > 0) {
      startGame(challenge.config.session);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge?.id, nouns.length]);

  if (phase === "ready" && !challenge) {
    return (
      <GameSessionSettings
        gameTitle={sortMode === "nouns" ? "Masculine or feminine?" : "Adjective agreement"}
        gameEyebrow="Gender Sort"
        gameDescription={
          sortMode === "nouns"
            ? "Sort nouns by gender. Answer quickly for bonus points."
            : "Pick the adjective form that agrees with the noun."
        }
        filterLabel="Category"
        filterOptions={filterOptions}
        poolSizeForFilter={poolSizeForFilter}
        repeatUnit="noun"
        canStart={nouns.length > 0}
        extraSettings={
          <>
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Mode</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: "nouns", label: "Noun gender" },
                    { id: "adjectives", label: "Adjective agreement" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSortMode(option.id)}
                    className={sortMode === option.id ? ui.pillActive : ui.pillInactive}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Your best</p>
              <p className="mt-1 text-lg font-bold text-zinc-900">
                {initialBestScore > 0 ? `${initialBestScore} pts` : "No score yet"}
              </p>
            </div>
          </>
        }
        onStart={startGame}
        gamesHubHref={gamesHubHref}
      />
    );
  }

  if (phase === "finished") {
    const totalQuestions = sessionLog.length || queue.length || adjectiveQueue.length;

    return (
      <>
        {challenge && (
          <ChallengePostGameBanner
            opponentName={challenge.opponentDisplayName}
            result={challengeFinish.result}
            error={challengeFinish.error}
            submitting={challengeFinish.submitting}
          />
        )}
        <GameSessionReview
          title="Sorting complete"
          correct={correct}
          total={totalQuestions}
          sessionLog={sessionLog}
          pointsEarned={result?.pointsEarned ?? 0}
          scoreSubtitle={`${score} points · ${totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0}% accuracy`}
          extraSummary={
            <>
              {result?.isNewBest && (
                <p className="mt-3 text-sm font-semibold text-green-700">New personal best!</p>
              )}
              {result && !result.isNewBest && result.currentBest > 0 && (
                <p className="mt-3 text-sm text-zinc-500">
                  Personal best: {result.currentBest} pts
                </p>
              )}
            </>
          }
          onPlayAgain={() => setPhase("ready")}
          hidePlayAgain={Boolean(challenge)}
          gamesHubHref={gamesHubHref}
        />
      </>
    );
  }

  if (sortMode === "adjectives" && adjectiveQuestion) {
    return (
      <div className="space-y-6">
        <SessionProgressBar current={index + 1} total={adjectiveQueue.length} />
        {challenge && <ChallengeModeBanner challenge={challenge} gameType="gender_sort" />}
        <div className="flex items-center justify-between gap-3">
          <Link href={gamesHubHref} className="text-sm font-medium text-violet-600 hover:text-violet-500">
            ← Exit
          </Link>
          <p className="text-sm font-semibold text-zinc-900">
            {index + 1} / {adjectiveQueue.length} · {score} pts
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Noun</p>
          <p className="mt-2 text-xl font-bold text-zinc-900">{adjectiveQuestion.nounEnglish}</p>
          <p className="mt-3 text-sm text-zinc-600">
            Pick the {adjectiveQuestion.adjectiveEnglish} form for this{" "}
            {adjectiveQuestion.nounGender} {adjectiveQuestion.nounNumber} noun
          </p>
        </div>

        <div className="grid gap-2">
          {adjectiveQuestion.options.map((option) => {
            const isSelected = adjectiveFeedback?.selected === option.punjabi;
            const isCorrect = option.punjabi === adjectiveQuestion.correctAnswer;
            const showResult = adjectiveFeedback !== null;

            return (
              <button
                key={option.punjabi}
                type="button"
                disabled={locked}
                onClick={() => handleAdjectiveAnswer(option.punjabi)}
                className={`rounded-xl border px-4 py-3 text-sm transition-colors ${
                  showResult && isCorrect
                    ? "border-green-400 bg-green-50"
                    : showResult && isSelected
                      ? "border-red-400 bg-red-50"
                      : "border-zinc-200 bg-white hover:border-violet-300 hover:bg-violet-50"
                }`}
              >
                <PunjabiOptionLabel
                  punjabi={option.punjabi}
                  romanised={option.romanised}
                  label={option.label}
                  centered
                />
              </button>
            );
          })}
        </div>

        {adjectiveFeedback && (
          <p className="text-center text-sm text-violet-600">
            <span className="block text-lg font-semibold text-zinc-900">
              {adjectiveQuestion.correctAnswer}
            </span>
            {adjectiveQuestion.correctRomanised ? (
              <span className="block text-lg font-medium text-violet-600">
                {adjectiveQuestion.correctRomanised}
              </span>
            ) : null}
          </p>
        )}

        {adjectiveFeedback && !adjectiveFeedback.correct && (
          <button
            type="button"
            onClick={handleContinueAfterWrongAdjective}
            className={ui.btnPrimaryBlock}
          >
            Next
          </button>
        )}
      </div>
    );
  }

  const cardBorderClass = feedback
    ? feedback.correct
      ? "border-green-300 bg-green-50"
      : "border-red-300 bg-red-50"
    : "border-zinc-200 bg-white";

  return (
    <div className="space-y-6">
      <SessionProgressBar current={index + 1} total={queue.length} />
      {challenge && <ChallengeModeBanner challenge={challenge} gameType="gender_sort" />}
      <div className="flex items-center justify-between gap-3">
        <Link href={gamesHubHref} className="text-sm font-medium text-violet-600 hover:text-violet-500">
          ← Exit
        </Link>
        <p className="text-sm font-semibold text-zinc-900">
          {index + 1} / {queue.length} · {score} pts
        </p>
      </div>

      <div className={`rounded-2xl border p-8 text-center shadow-sm transition-colors ${cardBorderClass}`}>
        {current && (
          <NounPromptDisplay
            punjabi={current.punjabi_word}
            romanised={current.romanised}
            english={current.english_meaning}
          />
        )}

        {feedback && (
          <div
            className={`mt-5 rounded-xl px-4 py-3 text-sm ${
              feedback.correct
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {feedback.correct ? (
              <>
                <p className="font-semibold">Correct!</p>
                {feedback.points > BASE_POINTS && (
                  <p className="mt-0.5">+{feedback.points} pts (speed bonus)</p>
                )}
                {feedback.points === BASE_POINTS && (
                  <p className="mt-0.5">+{feedback.points} pts</p>
                )}
              </>
            ) : (
              <>
                <p className="font-semibold">Not quite</p>
                <p className="mt-0.5">
                  You chose {genderLabel(feedback.chosen).toLowerCase()} — it&apos;s{" "}
                  <span className="font-semibold">{genderLabel(feedback.actual).toLowerCase()}</span>
                </p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => handleSort("masculine")}
          disabled={locked}
          className={`rounded-xl border-2 px-4 py-6 text-sm font-bold transition-opacity ${
            feedback?.chosen === "masculine" && feedback.correct
              ? "border-green-500 bg-green-100 text-green-900"
              : feedback?.chosen === "masculine" && !feedback.correct
                ? "border-red-500 bg-red-100 text-red-900"
                : "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100"
          } disabled:opacity-60`}
        >
          Masculine
        </button>
        <button
          type="button"
          onClick={() => handleSort("feminine")}
          disabled={locked}
          className={`rounded-xl border-2 px-4 py-6 text-sm font-bold transition-opacity ${
            feedback?.chosen === "feminine" && feedback.correct
              ? "border-green-500 bg-green-100 text-green-900"
              : feedback?.chosen === "feminine" && !feedback.correct
                ? "border-red-500 bg-red-100 text-red-900"
                : "border-pink-200 bg-pink-50 text-pink-800 hover:bg-pink-100"
          } disabled:opacity-60`}
        >
          Feminine
        </button>
      </div>

      {feedback && !feedback.correct && (
        <button
          type="button"
          onClick={handleContinueAfterWrongNoun}
          className={ui.btnPrimaryBlock}
        >
          Next
        </button>
      )}
    </div>
  );
}
