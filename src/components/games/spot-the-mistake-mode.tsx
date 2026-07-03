"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { EnglishWithGenderMarkers } from "@/components/english-with-gender-markers";
import { GameSessionReview } from "@/components/games/game-session-review";
import { GameSessionSettings } from "@/components/games/game-session-settings";
import { SessionProgressBar } from "@/components/session-progress-bar";
import { GAMES_HUB_HREF } from "@/lib/games/catalog";
import { saveGameScore } from "@/lib/games/game-scores";
import type { GenderedNoun, GrammarSentence } from "@/lib/games/types";
import type { GameSessionSettingsChoice } from "@/lib/games/session-settings";
import {
  SPOT_MAX_WRONG_TAPS,
  SPOT_THE_MISTAKE_DISPLAY_NAME,
} from "@/lib/spot-the-mistake/config";
import {
  assertDistractorShapeSample,
  buildSpotTheMistakeRound,
  filterSpotTheMistakeEligible,
} from "@/lib/spot-the-mistake/questions";
import type {
  SpotSentenceToken,
  SpotTheMistakeQuestion,
  SpotTheMistakeQuestionResult,
} from "@/lib/spot-the-mistake/types";
import { createClient } from "@/lib/supabase/client";

const ADVANCE_MS = 1400;

type Phase = "setup" | "playing" | "finished";
type QuestionStep = "spot" | "fix" | "revealed";

type SpotTheMistakeModeProps = {
  sentences: GrammarSentence[];
  genderedNouns: GenderedNoun[];
  tableReady: boolean;
  loadError: string | null;
};

export function SpotTheMistakeMode({
  sentences,
  genderedNouns,
  tableReady,
  loadError,
}: SpotTheMistakeModeProps) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [questions, setQuestions] = useState<SpotTheMistakeQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questionStep, setQuestionStep] = useState<QuestionStep>("spot");
  const [results, setResults] = useState<SpotTheMistakeQuestionResult[]>([]);
  const [wrongSpotTaps, setWrongSpotTaps] = useState(0);
  const [spotCorrectFirstTry, setSpotCorrectFirstTry] = useState(false);
  const [fixCorrectFirstTry, setFixCorrectFirstTry] = useState(false);
  const [highlightedMistake, setHighlightedMistake] = useState(false);
  const [selectedFixId, setSelectedFixId] = useState<string | null>(null);
  const [pointsEarned, setPointsEarned] = useState(0);

  const advanceTimerRef = useRef<number | null>(null);
  const userIdRef = useRef<string | null>(null);
  const savedRef = useRef(false);

  const eligibleSentences = useMemo(
    () =>
      filterSpotTheMistakeEligible(
        sentences,
        genderedNouns.map((noun) => ({
          punjabi_word: noun.punjabi_word,
          romanised: noun.romanised,
        }))
      ),
    [sentences, genderedNouns]
  );

  const poolSizeForFilter = useCallback(() => eligibleSentences.length, [eligibleSentences.length]);

  const current = questions[questionIndex];
  const fullySolvedCount = results.filter(
    (result) => result.spot_correct_first_try && result.fix_correct_first_try
  ).length;

  useEffect(() => {
    assertDistractorShapeSample(sentences);
  }, [sentences]);

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
    const correct = results.filter(
      (result) => result.spot_correct_first_try && result.fix_correct_first_try
    ).length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    const persist = async () => {
      const userId = userIdRef.current;
      if (!userId) return;

      const supabase = createClient();
      const outcome = await saveGameScore(supabase, userId, "spot_the_mistake", correct, {
        accuracy,
        correct,
        total,
        question_count: total,
        questions: results,
      });
      setPointsEarned(outcome.pointsEarned);
    };

    void persist();
  }, [phase, questions.length, results]);

  function resetQuestionState() {
    setQuestionStep("spot");
    setWrongSpotTaps(0);
    setSpotCorrectFirstTry(false);
    setFixCorrectFirstTry(false);
    setHighlightedMistake(false);
    setSelectedFixId(null);
  }

  function startRound(choice: GameSessionSettingsChoice) {
    const round = buildSpotTheMistakeRound(eligibleSentences, genderedNouns, choice.questionCount);
    if (round.questions.length === 0) return;

    savedRef.current = false;
    setQuestions(round.questions);
    setQuestionIndex(0);
    setResults([]);
    resetQuestionState();
    setPhase("playing");
  }

  function scheduleAdvance(callback: () => void) {
    if (advanceTimerRef.current) {
      window.clearTimeout(advanceTimerRef.current);
    }
    advanceTimerRef.current = window.setTimeout(callback, ADVANCE_MS);
  }

  function finishQuestion(result: SpotTheMistakeQuestionResult) {
    const nextResults = [...results, result];

    if (questionIndex + 1 >= questions.length) {
      setResults(nextResults);
      setPhase("finished");
      return;
    }

    setResults(nextResults);
    setQuestionIndex((index) => index + 1);
    resetQuestionState();
  }

  function proceedToFix(spotFirstTry: boolean) {
    setSpotCorrectFirstTry(spotFirstTry);
    setHighlightedMistake(true);
    setQuestionStep("fix");
  }

  function handleSpotTap(token: SpotSentenceToken) {
    if (!current || questionStep !== "spot") return;

    if (token.isMistake) {
      proceedToFix(wrongSpotTaps === 0);
      return;
    }

    const nextWrong = wrongSpotTaps + 1;
    setWrongSpotTaps(nextWrong);

    if (nextWrong >= SPOT_MAX_WRONG_TAPS) {
      proceedToFix(false);
    }
  }

  function handleFixSelect(optionId: string) {
    if (!current || questionStep !== "fix" || selectedFixId) return;

    const isCorrect = optionId === current.correctFixOptionId;
    const spotFirst = spotCorrectFirstTry;

    setSelectedFixId(optionId);
    setFixCorrectFirstTry(isCorrect);
    setQuestionStep("revealed");

    scheduleAdvance(() => {
      finishQuestion({
        grammar_sentence_id: current.grammarSentenceId,
        spot_correct_first_try: spotFirst,
        fix_correct_first_try: isCorrect,
      });
    });
  }

  if (phase === "setup") {
    return (
      <GameSessionSettings
        gameTitle={SPOT_THE_MISTAKE_DISPLAY_NAME}
        gameEyebrow="Grammar detective"
        gameDescription="Find the wrong word in each sentence — it might be the verb or an object — then pick the correction."
        filterLabel="Pool"
        filterOptions={[{ id: "all", label: "All eligible sentences" }]}
        poolSizeForFilter={poolSizeForFilter}
        canStart={tableReady && eligibleSentences.length > 0 && genderedNouns.length >= 3}
        extraSettings={
          <p className="text-sm text-zinc-500">
            Tense and difficulty filters are a natural v2 addition — v1 draws randomly from every
            eligible sentence.
          </p>
        }
        unavailableMessage={
          !tableReady ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Run <code className="text-xs">supabase/games.sql</code> to enable grammar games.
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              Could not load grammar sentences: {loadError}
            </div>
          ) : eligibleSentences.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No sentences with usable verb distractors yet.
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
        title="Case closed"
        correct={fullySolvedCount}
        total={questions.length}
        sessionLog={[]}
        pointsEarned={pointsEarned}
        scoreSubtitle="Fully solved on first try (spotted and fixed)"
        onPlayAgain={() => setPhase("setup")}
      />
    );
  }

  const activeTokens =
    questionStep === "revealed" ? current.correctedTokens : current.tokens;

  const activeRomanised =
    questionStep === "revealed" ? current.correctedRomanised : current.brokenRomanised;

  return (
    <div className="space-y-4">
      <SessionProgressBar current={questionIndex + 1} total={questions.length} />

      <div className="flex items-center justify-between gap-3">
        <Link
          href={GAMES_HUB_HREF}
          className="text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          ← Exit
        </Link>
        <p className="text-sm font-semibold text-zinc-900">
          {questionIndex + 1} / {questions.length} · {fullySolvedCount} solved
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
          {questionStep === "spot" && "Step 1 — Spot the mistake"}
          {questionStep === "fix" &&
            (current.mistakeKind === "object"
              ? "Step 2 — Pick the right object"
              : "Step 2 — Pick the right verb")}
          {questionStep === "revealed" && "Corrected sentence"}
        </p>

        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {activeTokens.map((token) => {
            const isMistakeHighlighted =
              highlightedMistake && token.isMistake && questionStep !== "spot";

            let className =
              "rounded-xl border px-3 py-2 text-center transition-colors ";

            if (questionStep === "spot") {
              className += "border-zinc-200 bg-zinc-50 hover:border-violet-400 hover:bg-violet-50";
            } else if (isMistakeHighlighted) {
              className +=
                questionStep === "revealed"
                  ? "border-green-400 bg-green-50"
                  : "border-amber-400 bg-amber-50";
            } else {
              className += "border-zinc-200 bg-zinc-50";
            }

            return (
              <button
                key={token.id}
                type="button"
                disabled={questionStep !== "spot"}
                onClick={() => handleSpotTap(token)}
                className={className}
              >
                <span className="block text-base font-semibold text-zinc-900">{token.gurmukhi}</span>
                {token.romanised ? (
                  <span className="block text-xs text-violet-600">{token.romanised}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-center text-sm text-violet-600">{activeRomanised}</p>
        <EnglishWithGenderMarkers
          as="p"
          text={current.englishTranslation}
          className="mt-2 text-center text-sm text-zinc-500"
        />
      </div>

      {questionStep === "spot" && wrongSpotTaps > 0 && wrongSpotTaps < SPOT_MAX_WRONG_TAPS ? (
        <p className="text-center text-sm text-amber-800">
          Not that word — try again ({SPOT_MAX_WRONG_TAPS - wrongSpotTaps} left)
        </p>
      ) : null}

      {(questionStep === "fix" || questionStep === "revealed") && (
        <div className="space-y-2">
          {questionStep === "fix" ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                What should this word be?
              </p>
              {!spotCorrectFirstTry ? (
                <p className="text-sm text-amber-800">
                  The highlighted word is the mistake — pick the{" "}
                  {current.mistakeKind === "object" ? "correct object" : "correct verb"}.
                </p>
              ) : null}
            </>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            {current.fixOptions.map((option) => {
              const isSelected = selectedFixId === option.id;
              const isCorrect = option.id === current.correctFixOptionId;
              const showResult = questionStep === "revealed";

              let className =
                "rounded-xl border px-4 py-3 text-left transition-colors ";

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
                  onClick={() => handleFixSelect(option.id)}
                  className={className}
                >
                  <span className="font-semibold text-zinc-900">{option.gurmukhi}</span>
                  <span className="block text-sm text-violet-600">{option.romanised}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {questionStep === "revealed" ? (
        <p
          className={`text-center text-sm font-medium ${
            spotCorrectFirstTry && fixCorrectFirstTry ? "text-green-700" : "text-zinc-600"
          }`}
        >
          {spotCorrectFirstTry && fixCorrectFirstTry
            ? "Nailed it — verb agreement detective!"
            : "Here's the corrected sentence."}
        </p>
      ) : null}
    </div>
  );
}
