"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  buildChallengeRound,
  computeGroupBreakdown,
  type ChallengeQuestion,
} from "@/lib/conjugation/challenge";
import type { TenseGroup } from "@/lib/conjugation/types";
import {
  filterGrammarSentencesByTenseValue,
  parseDistractorConjugations,
} from "@/lib/games/grammar-sentence";
import type { GrammarSentence } from "@/lib/games/types";
import { GameSessionReview } from "@/components/games/game-session-review";
import { GameSessionSettings } from "@/components/games/game-session-settings";
import { GAMES_HUB_HREF } from "@/lib/games/catalog";
import { saveGameScore } from "@/lib/games/game-scores";
import { buildConjugationChallengeLogEntry } from "@/lib/games/session-review-builders";
import type { RoundResult } from "@/lib/games/session-review";
import type { GameSessionSettingsChoice } from "@/lib/games/session-settings";
import { ChallengeModeBanner } from "@/components/challenges/challenge-mode-banner";
import { EnglishWithGenderMarkers } from "@/components/english-with-gender-markers";
import { ui } from "@/lib/ui/styles";
import { ChallengePostGameBanner } from "@/components/challenges/challenge-post-game-banner";
import { useChallengeFinish } from "@/lib/challenges/use-challenge-finish";
import type { ChallengePlayContext } from "@/lib/challenges/types";
const FEEDBACK_MS = 1000;

type Phase = "setup" | "playing" | "finished";

type AnswerFeedback = {
  selected: string;
  isCorrect: boolean;
};

const GROUP_LABELS: Record<TenseGroup, string> = {
  present: "Present",
  past: "Past",
  future: "Future",
};

function PunjabiWithRomanised({
  punjabi,
  romanised,
  textClassName = "text-lg",
  punjabiClassName = "font-semibold text-zinc-900",
  romanisedClassName = "font-normal text-violet-600",
}: {
  punjabi: string;
  romanised?: string;
  textClassName?: string;
  punjabiClassName?: string;
  romanisedClassName?: string;
}) {
  return (
    <span className="flex w-full flex-col items-center text-center gap-0.5">
      <span className={`${textClassName} ${punjabiClassName}`}>{punjabi}</span>
      {romanised ? (
        <span className={`${textClassName} ${romanisedClassName}`}>{romanised}</span>
      ) : null}
    </span>
  );
}

type ConjugationChallengeModeProps = {
  sentences: GrammarSentence[];
  tableReady: boolean;
  loadError: string | null;
  challenge?: ChallengePlayContext | null;
};

const PROMPT_TASK_LABEL = "Pick the correct verb form";

function PromptTaskLabel() {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
      {PROMPT_TASK_LABEL}
    </p>
  );
}

function QuestionPrompt({ question }: { question: ChallengeQuestion }) {
  if (question.format === "A") {
    return (
      <div className="space-y-1.5 text-center">
        <PromptTaskLabel />
        <p className="text-lg font-semibold leading-snug text-zinc-900">
          {question.verbRoot}
          <span className="text-zinc-400"> ___</span>
          {question.verbRootRomanised && (
            <span className="font-normal text-violet-600">
              {" "}
              ({question.verbRootRomanised} ___)
            </span>
          )}
        </p>
        <EnglishWithGenderMarkers
          as="p"
          text={question.english}
          className="text-sm text-zinc-500"
        />
        <p className="text-sm leading-snug">
          <span className="font-medium text-violet-700">{question.tenseLabel}</span>
        </p>
      </div>
    );
  }

  if (question.format === "B") {
    return (
      <div className="space-y-1.5 text-center">
        <PromptTaskLabel />
        <p className="text-xl font-semibold leading-snug text-zinc-900">
          {question.gapSentence}
        </p>
        {question.gapSentenceRomanised ? (
          <p className="text-lg font-normal leading-snug text-violet-600">
            {question.gapSentenceRomanised}
          </p>
        ) : null}
        <EnglishWithGenderMarkers
          as="p"
          text={question.englishGloss}
          className="text-sm text-zinc-500"
        />
      </div>
    );
  }

  return null;
}

export function ConjugationChallengeMode({
  sentences,
  tableReady,
  loadError,
  challenge = null,
}: ConjugationChallengeModeProps) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [questions, setQuestions] = useState<ChallengeQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [sessionLog, setSessionLog] = useState<RoundResult[]>([]);
  const [pointsEarned, setPointsEarned] = useState(0);

  const advanceTimerRef = useRef<number | null>(null);
  const userIdRef = useRef<string | null>(null);
  const savedRef = useRef(false);

  const playableSentences = useMemo(
    () =>
      sentences.filter(
        (sentence) =>
          sentence.target_verb_gurmukhi &&
          parseDistractorConjugations(sentence.distractor_conjugations).length >= 2
      ),
    [sentences]
  );
  const availableTenseValues = useMemo(() => {
    const values = new Set<string>();
    for (const sentence of playableSentences) {
      if (sentence.tense?.trim()) values.add(sentence.tense.trim());
    }
    return [...values];
  }, [playableSentences]);
  const poolSizeForFilter = useCallback(
    (filterIds: string[]) =>
      filterGrammarSentencesByTenseValue(playableSentences, filterIds).length,
    [playableSentences]
  );

  const current = questions[questionIndex];
  const score = results.filter(Boolean).length;
  const canStart = tableReady && playableSentences.length > 0;
  const total = questions.length;
  const correct = results.filter(Boolean).length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  const challengeFinish = useChallengeFinish({
    challengeId: challenge?.id,
    score: correct,
    scoreMetadata: { accuracy, correct, total, rounds: total, sessionLog },
    enabled: phase === "finished" && Boolean(challenge),
  });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      userIdRef.current = user?.id ?? null;
    });
  }, []);

  useEffect(() => {
    if (phase !== "finished" || savedRef.current) return;
    savedRef.current = true;

    const total = questions.length;
    const correct = results.filter(Boolean).length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    const persist = async () => {
      const userId = userIdRef.current;
      if (!userId) return;

      const supabase = createClient();
      const outcome = await saveGameScore(supabase, userId, "conjugation_challenge", correct, {
        accuracy,
        correct,
        total,
        rounds: total,
        sessionLog,
      });
      setPointsEarned(outcome.pointsEarned);
    };

    void persist();
  }, [phase, questions.length, results, sessionLog]);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) {
        window.clearTimeout(advanceTimerRef.current);
      }
    };
  }, []);

  function startRound(choice: GameSessionSettingsChoice) {
    savedRef.current = false;
    const round = buildChallengeRound(sentences, {
      questionCount: choice.questionCount,
      tenseFilter: choice.filterIds,
      seed: challenge?.config.seed,
    });

    if (round.questions.length === 0) return;

    setQuestions(round.questions);
    setQuestionIndex(0);
    setResults([]);
    setSessionLog([]);
    setFeedback(null);
    setPhase("playing");
  }

  function commitAnswer(isCorrect: boolean) {
    const nextResults = [...results, isCorrect];

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

  function handleAnswer(answer: string) {
    if (phase !== "playing" || !current || feedback) return;

    const isCorrect = answer === current.correctAnswer;
    setSessionLog((prev) => [
      ...prev,
      buildConjugationChallengeLogEntry(current, answer, isCorrect),
    ]);
    setFeedback({ selected: answer, isCorrect });

    if (isCorrect) {
      advanceTimerRef.current = window.setTimeout(() => {
        commitAnswer(true);
      }, FEEDBACK_MS);
    }
  }

  function handleContinueAfterWrong() {
    if (!feedback || feedback.isCorrect) return;
    commitAnswer(false);
  }

  useEffect(() => {
    if (challenge?.config.session && phase === "setup" && canStart) {
      startRound(challenge.config.session);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-start locked challenge session once
  }, [challenge?.id, canStart]);

  if (phase === "setup" && !challenge) {
    return (
      <GameSessionSettings
        gameTitle="Test your verb forms"
        gameEyebrow="Conjugation Challenge"
        gameDescription="Multiple-choice questions — no typing required."
        filterLabel="Tense"
        tenseFilterValues={availableTenseValues}
        poolSizeForFilter={poolSizeForFilter}
        canStart={canStart}
        unavailableMessage={
          !tableReady ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Run <code className="text-xs">supabase/games.sql</code> to enable this game.
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              Could not load grammar sentences: {loadError}
            </div>
          ) : playableSentences.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No conjugation prompts found yet. More course content is coming soon.
            </div>
          ) : undefined
        }
        onStart={startRound}
      />
    );
  }

  if (phase === "finished") {
    const breakdown = computeGroupBreakdown(questions, results);

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
        title="Challenge complete"
        correct={score}
        total={total}
        sessionLog={sessionLog}
        pointsEarned={pointsEarned}
        extraSummary={
          <div className="mt-5 space-y-2 text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              By tense group
            </p>
            {(["present", "past", "future"] as const).map((group) => {
              const stats = breakdown[group];
              if (stats.total === 0) return null;
              return (
                <div
                  key={group}
                  className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-zinc-700">{GROUP_LABELS[group]}</span>
                  <span className="text-zinc-600">
                    {stats.correct}/{stats.total}
                  </span>
                </div>
              );
            })}
          </div>
        }
        onPlayAgain={() => setPhase("setup")}
        hidePlayAgain={Boolean(challenge)}
      />
      </>
    );
  }

  return (
    <div className="space-y-3">
      {challenge && <ChallengeModeBanner challenge={challenge} gameType="conjugation_challenge" />}
      <div className="flex items-center justify-between gap-3">
        <Link
          href={GAMES_HUB_HREF}
          className="text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          ← Exit
        </Link>
        <p className="text-sm font-semibold text-zinc-900">
          {questionIndex + 1} / {questions.length} · {score} correct
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
        {current && <QuestionPrompt question={current} />}
      </div>

      <div className="grid gap-2">
        {current?.options.map((option) => {
          const isSelected = feedback?.selected === option.punjabi;
          const isCorrect = option.punjabi === current.correctAnswer;
          const showResult = feedback !== null;

          let className =
            "relative flex flex-col items-center justify-center rounded-xl border px-3 py-3 text-center text-sm font-medium transition-colors ";

          if (showResult) {
            if (isCorrect) {
              className += "border-green-400 bg-green-50 text-green-900";
            } else if (isSelected) {
              className += "border-red-400 bg-red-50 text-red-900";
            } else {
              className += "border-zinc-200 bg-white text-zinc-600";
            }
          } else {
            className +=
              "border-zinc-200 bg-white text-zinc-900 hover:border-violet-300 hover:bg-violet-50";
          }

          return (
            <button
              key={option.punjabi}
              type="button"
              disabled={Boolean(feedback)}
              onClick={() => handleAnswer(option.punjabi)}
              className={className}
            >
              <PunjabiWithRomanised
                punjabi={option.punjabi}
                romanised={option.romanised}
                textClassName={current.format === "B" ? "text-base" : "text-lg"}
                punjabiClassName="font-medium"
                romanisedClassName={
                  showResult && isCorrect
                    ? "font-normal text-green-700"
                    : showResult && isSelected
                      ? "font-normal text-red-700"
                      : "font-normal text-violet-600"
                }
              />
              {showResult && isCorrect && (
                <span
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-green-600"
                  aria-hidden="true"
                >
                  ✓
                </span>
              )}
              {showResult && isSelected && !isCorrect && (
                <span
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-red-600"
                  aria-hidden="true"
                >
                  ✗
                </span>
              )}
            </button>
          );
        })}
      </div>

      {feedback && !feedback.isCorrect && (
        <button
          type="button"
          onClick={handleContinueAfterWrong}
          className={ui.btnPrimaryBlock}
        >
          Next
        </button>
      )}
    </div>
  );
}
