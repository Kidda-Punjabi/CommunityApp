"use client";

import { BackLink } from "@/components/navigation/back-link";
import { useMemo, useState } from "react";
import { FloatingSoundToggle } from "@/components/audio/floating-sound-toggle";
import { useAudioManager } from "@/lib/audio/audio-manager";
import { usePlaySoundOnce } from "@/lib/audio/use-play-sound";
import { LevelTestQuestionBody } from "@/components/progression/level-test-question-body";
import { SessionProgressBar } from "@/components/session-progress-bar";
import { pickCycledPool } from "@/lib/games/session-settings";
import {
  LEVEL_TEST_PASS_PCT,
  LEVEL_TEST_QUESTION_COUNT,
  type LevelTestQuestion,
} from "@/lib/progression/level-tests";
import { levelTestLabel } from "@/lib/progression/tiers";
import { ui } from "@/lib/ui/styles";

type LevelTestPlayerProps = {
  fromLevel: number;
  questions: LevelTestQuestion[];
  mode: "placement" | "progression";
  backHref: string;
  onComplete: (result: {
    correctCount: number;
    totalCount: number;
    scorePct: number;
  }) => Promise<void>;
};

const LIGHT_SURFACE = "bg-white text-zinc-900 [color-scheme:light]";
const ADVANCE_MS = 450;

export function LevelTestPlayer({
  fromLevel,
  questions,
  mode,
  backHref,
  onComplete,
}: LevelTestPlayerProps) {
  const sessionQuestions = useMemo(
    () => pickCycledPool(questions, Math.min(LEVEL_TEST_QUESTION_COUNT, questions.length)),
    [questions]
  );

  const [index, setIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    scorePct: number;
    passed: boolean;
    correctCount: number;
    totalCount: number;
  } | null>(null);

  const question = sessionQuestions[index];
  const locked = selectedOptionId !== null;
  const { playSound } = useAudioManager();

  function advanceAfterAnswer(isCorrect: boolean, optionId: string | null) {
    if (!question || locked || finished) return;

    playSound(isCorrect ? "correct" : "incorrect");

    setSelectedOptionId(optionId ?? "__answered__");
    const nextCorrect = correctCount + (isCorrect ? 1 : 0);

    window.setTimeout(async () => {
      if (index + 1 >= sessionQuestions.length) {
        const totalCount = sessionQuestions.length;
        const scorePct = Math.round((nextCorrect / totalCount) * 100);
        setCorrectCount(nextCorrect);
        setFinished(true);
        setSubmitting(true);
        setResult({
          scorePct,
          passed: scorePct >= LEVEL_TEST_PASS_PCT,
          correctCount: nextCorrect,
          totalCount,
        });
        await onComplete({
          correctCount: nextCorrect,
          totalCount,
          scorePct,
        });
        setSubmitting(false);
        return;
      }

      setCorrectCount(nextCorrect);
      setIndex((current) => current + 1);
      setSelectedOptionId(null);
    }, ADVANCE_MS);
  }

  function handleSelectOption(optionId: string, isCorrect: boolean) {
    advanceAfterAnswer(isCorrect, optionId);
  }

  function handleSentenceBuilderAnswer(isCorrect: boolean) {
    advanceAfterAnswer(isCorrect, "__answered__");
  }

  if (questions.length === 0) {
    return (
      <div className={`${ui.card} ${LIGHT_SURFACE}`}>
        <p className="text-sm text-zinc-700">
          Questions for this test aren&apos;t available yet. Check back soon.
        </p>
        <BackLink fallbackHref={backHref} className="mt-4 inline-block text-sm font-medium text-violet-600">← Back</BackLink>
      </div>
    );
  }

  if (finished && result) {
    return (
      <LevelTestResultScreen mode={mode} fromLevel={fromLevel} result={result} submitting={submitting} />
    );
  }

  return (
    <div className={`relative space-y-5 ${LIGHT_SURFACE}`}>
      <FloatingSoundToggle />
      <SessionProgressBar current={index + 1} total={sessionQuestions.length} />
      <div className="flex items-center justify-between gap-3">
        <BackLink fallbackHref={backHref} className="text-sm font-medium text-violet-700 hover:text-violet-600">← Exit</BackLink>
        <p className="text-sm font-semibold text-zinc-900">
          {index + 1} / {sessionQuestions.length}
        </p>
      </div>

      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {levelTestLabel(fromLevel)}
      </p>

      {question ? (
        <LevelTestQuestionBody
          key={question.id}
          question={question}
          locked={locked}
          selectedOptionId={selectedOptionId}
          onSelectOption={handleSelectOption}
          onSentenceBuilderAnswer={handleSentenceBuilderAnswer}
        />
      ) : null}
    </div>
  );
}

function LevelTestResultScreen({
  mode,
  fromLevel,
  result,
  submitting,
}: {
  mode: "placement" | "progression";
  fromLevel: number;
  result: {
    scorePct: number;
    passed: boolean;
    correctCount: number;
    totalCount: number;
  };
  submitting: boolean;
}) {
  usePlaySoundOnce("game_complete");
  usePlaySoundOnce("level_up", mode === "progression" && result.passed);

  return (
    <div className={`relative ${ui.card} ${LIGHT_SURFACE} space-y-4 text-center`}>
      <FloatingSoundToggle />
      <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">
        {mode === "placement" ? "Placement result" : levelTestLabel(fromLevel)}
      </p>
      <h2 className="text-3xl font-bold text-zinc-900">{result.scorePct}%</h2>
      <p className="text-sm text-zinc-700">
        {result.correctCount}/{result.totalCount} correct · need {LEVEL_TEST_PASS_PCT}%+ to pass
      </p>
      {submitting ? (
        <p className="text-sm text-zinc-600">Saving…</p>
      ) : (
        <p
          className={`text-sm font-semibold ${result.passed ? "text-green-800" : "text-amber-800"}`}
        >
          {result.passed ? "Passed!" : "Not quite — you can try again anytime."}
        </p>
      )}
    </div>
  );
}
