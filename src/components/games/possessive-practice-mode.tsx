"use client";

import { BackLink } from "@/components/navigation/back-link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { EnglishWithGenderMarkers } from "@/components/english-with-gender-markers";
import { GameSessionReview } from "@/components/games/game-session-review";
import { GameSessionSettings } from "@/components/games/game-session-settings";
import { SessionProgressBar } from "@/components/session-progress-bar";
import { GAMES_HUB_HREF } from "@/lib/games/catalog";
import { saveGameScore } from "@/lib/games/game-scores";
import type { GameSessionSettingsChoice } from "@/lib/games/session-settings";
import {
  KIHDA_DISPLAY_NAME,
  POSSESSIVE_TIER_DESCRIPTIONS,
  POSSESSIVE_TIER_FILTER_OPTIONS,
  POSSESSIVE_TIER_LABELS,
  type PossessiveTier,
} from "@/lib/possessive-practice/config";
import { possessivePoolSize } from "@/lib/possessive-practice/load-possessive-practice";
import { buildPossessiveRound } from "@/lib/possessive-practice/questions";
import type {
  PossessivePracticeContent,
  PossessiveQuestion,
  PossessiveQuestionResult,
} from "@/lib/possessive-practice/types";
import { createClient } from "@/lib/supabase/client";

const FEEDBACK_MS = 1000;

type Phase = "setup" | "playing" | "finished";

type AnswerFeedback = {
  selectedOptionId: string;
  isCorrect: boolean;
};

type PossessivePracticeModeProps = PossessivePracticeContent;

export function PossessivePracticeMode({
  nouns,
  possessiveForms,
  postpositions,
  tablesReady,
  loadError,
}: PossessivePracticeModeProps) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [questions, setQuestions] = useState<PossessiveQuestion[]>([]);
  const [playedTier, setPlayedTier] = useState<PossessiveTier>("normal");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [results, setResults] = useState<PossessiveQuestionResult[]>([]);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [pointsEarned, setPointsEarned] = useState(0);

  const advanceTimerRef = useRef<number | null>(null);
  const userIdRef = useRef<string | null>(null);
  const savedRef = useRef(false);

  const canStart =
    tablesReady &&
    nouns.length > 0 &&
    possessiveForms.length > 0 &&
    postpositions.length > 0;

  const poolSizeForFilter = useCallback(
    (filterIds: string[]) => {
      const tier = (filterIds[0] ?? "normal") as PossessiveTier;
      return possessivePoolSize(
        tier,
        nouns.length,
        possessiveForms.length,
        postpositions.length
      );
    },
    [nouns.length, possessiveForms.length, postpositions.length]
  );

  const current = questions[questionIndex];
  const correctCount = results.filter((result) => result.correct).length;

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

    const total = questions.length;
    const correct = results.filter((result) => result.correct).length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    const persist = async () => {
      const userId = userIdRef.current;
      if (!userId) return;

      const supabase = createClient();
      const outcome = await saveGameScore(supabase, userId, "possessive_practice", correct, {
        accuracy,
        correct,
        total,
        tier: playedTier,
        question_count: total,
        questions: results,
      });
      setPointsEarned(outcome.pointsEarned);
    };

    void persist();
  }, [phase, questions.length, results, playedTier]);

  function startRound(choice: GameSessionSettingsChoice) {
    const tier = (choice.filterIds[0] ?? "normal") as PossessiveTier;
    const round = buildPossessiveRound(
      nouns,
      possessiveForms,
      postpositions,
      tier,
      choice.questionCount
    );

    if (round.length === 0) return;

    savedRef.current = false;
    setPlayedTier(tier);
    setQuestions(round);
    setQuestionIndex(0);
    setResults([]);
    setFeedback(null);
    setPhase("playing");
  }

  function commitAnswer(result: PossessiveQuestionResult) {
    const nextResults = [...results, result];

    if (questionIndex + 1 >= questions.length) {
      setResults(nextResults);
      setFeedback(null);
      setPhase("finished");
      return;
    }

    setResults(nextResults);
    setQuestionIndex((index) => index + 1);
    setFeedback(null);
  }

  function handleAnswer(optionId: string) {
    if (phase !== "playing" || !current || feedback) return;

    const isCorrect = optionId === current.correctOptionId;
    const result: PossessiveQuestionResult = {
      possessive_form_id: current.possessiveFormId,
      noun_id: current.nounId,
      postposition_id: current.postpositionId,
      selected_option: optionId,
      correct: isCorrect,
    };

    setFeedback({ selectedOptionId: optionId, isCorrect });

    advanceTimerRef.current = window.setTimeout(() => {
      commitAnswer(result);
    }, FEEDBACK_MS);
  }

  if (phase === "setup") {
    return (
      <GameSessionSettings
        gameTitle={KIHDA_DISPLAY_NAME}
        gameEyebrow="Possessive Practice"
        gameDescription="Pick the correct possessive form — mera, meri, mere and more — matched to each noun."
        filterLabel="Tier"
        filterOptions={POSSESSIVE_TIER_FILTER_OPTIONS}
        poolSizeForFilter={poolSizeForFilter}
        repeatUnit="noun"
        canStart={canStart}
        extraSettings={
          <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
            {POSSESSIVE_TIER_FILTER_OPTIONS.map((option) => (
              <p key={option.id}>
                <span className="font-semibold text-zinc-800">{option.label}</span>
                {" — "}
                {POSSESSIVE_TIER_DESCRIPTIONS[option.id as PossessiveTier]}
              </p>
            ))}
          </div>
        }
        unavailableMessage={
          !tablesReady ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Run <code className="text-xs">supabase/possessive-practice.sql</code> to enable
              this game.
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              Could not load possessive practice content: {loadError}
            </div>
          ) : nouns.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No gendered nouns available yet.
            </div>
          ) : possessiveForms.length === 0 || postpositions.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Possessive reference data is missing — run the migration SQL.
            </div>
          ) : undefined
        }
        onStart={startRound}
      />
    );
  }

  if (phase === "finished") {
    return (
      <GameSessionReview
        title="Round complete"
        correct={correctCount}
        total={questions.length}
        sessionLog={[]}
        pointsEarned={pointsEarned}
        scoreSubtitle={`${POSSESSIVE_TIER_LABELS[playedTier]} tier`}
        onPlayAgain={() => setPhase("setup")}
      />
    );
  }

  return (
    <div className="space-y-3">
      <SessionProgressBar current={questionIndex + 1} total={questions.length} />

      <div className="flex items-center justify-between gap-3">
        <BackLink fallbackHref={GAMES_HUB_HREF} className="text-sm font-medium text-violet-600 hover:text-violet-500">← Exit</BackLink>
        <p className="text-sm font-semibold text-zinc-900">
          {questionIndex + 1} / {questions.length} · {correctCount} correct
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Pick the correct possessive
        </p>
        <EnglishWithGenderMarkers
          as="p"
          text={current?.promptEnglish ?? ""}
          className="mt-2 text-center text-lg font-semibold leading-snug text-zinc-900"
        />
        {current?.tier === "oblique" ? (
          <p className="mt-1 text-center text-xs font-medium uppercase tracking-wider text-violet-600">
            Oblique
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        {current?.options.map((option) => {
          const isSelected = feedback?.selectedOptionId === option.id;
          const isCorrect = option.id === current.correctOptionId;
          const showResult = feedback !== null;

          let className =
            "flex flex-col rounded-xl border px-4 py-3 text-left transition-colors ";

          if (showResult) {
            if (isCorrect) {
              className += "border-green-400 bg-green-50";
            } else if (isSelected) {
              className += "border-red-300 bg-red-50";
            } else {
              className += "border-zinc-200 bg-white opacity-60";
            }
          } else {
            className += "border-zinc-200 bg-white hover:border-violet-300 hover:bg-violet-50/40";
          }

          return (
            <button
              key={option.id}
              type="button"
              disabled={showResult}
              onClick={() => handleAnswer(option.id)}
              className={className}
            >
              <span className="font-semibold text-zinc-900">{option.gurmukhi}</span>
              <span className="text-sm text-violet-600">{option.romanised}</span>
              <span className="text-sm text-zinc-500">{option.english}</span>
            </button>
          );
        })}
      </div>

      {feedback ? (
        <p
          className={`text-center text-sm font-medium ${
            feedback.isCorrect ? "text-green-700" : "text-amber-800"
          }`}
        >
          {feedback.isCorrect ? "Correct!" : "Not quite — keep going."}
        </p>
      ) : null}
    </div>
  );
}
