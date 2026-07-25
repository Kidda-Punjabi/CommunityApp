"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { FlashcardDeckCard } from "@/lib/flashcards/types";
import { completeTopicActivity } from "@/app/dashboard/learn/free/actions";
import type { TopicGameActivitySpec } from "@/lib/free-lessons/activity-games";
import { TopicMatchActivity } from "@/components/learn/topic-match-activity";
import { TopicSpeedQuizActivity } from "@/components/learn/topic-speed-quiz-activity";
import { TopicTilesActivity } from "@/components/learn/topic-tiles-activity";
import { TopicSpeakActivity } from "@/components/learn/topic-speak-activity";
import { flashcardToSpeakingCard } from "@/lib/free-lessons/topic-game-utils";

type TopicGamePracticeProps = {
  lessonId: string;
  topicTitle: string;
  cards: FlashcardDeckCard[];
  spec: TopicGameActivitySpec;
};

export function TopicGamePractice({
  lessonId,
  topicTitle,
  cards,
  spec,
}: TopicGamePracticeProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [runKey, setRunKey] = useState(0);
  const [finished, setFinished] = useState<{
    percent: number;
    passed: boolean;
    correct: number;
    total: number;
    masteryLevel: number;
    mastered: boolean;
    stageCleared: boolean;
    stage: number;
  } | null>(null);

  function restartActivity() {
    setFinished(null);
    setError(null);
    setRunKey((value) => value + 1);
  }

  const speakReady =
    cards.map(flashcardToSpeakingCard).filter(Boolean).length >= 2;

  function handleComplete(result: {
    percent: number;
    correct: number;
    total: number;
  }) {
    const passed = result.percent >= spec.passThreshold;
    startTransition(async () => {
      try {
        const saved = await completeTopicActivity({
          lessonId,
          passed,
          scorePercent: result.percent,
        });
        setFinished({
          percent: result.percent,
          passed,
          correct: result.correct,
          total: result.total,
          masteryLevel: saved.masteryLevel,
          mastered: saved.mastered,
          stageCleared: saved.stageCleared,
          stage: saved.stage,
        });
        // Do not refresh here — that remounts the next activity immediately.
        // User chooses Next activity / Back to topic explicitly.
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save progress.");
      }
    });
  }

  if (finished) {
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {spec.title}
        </p>
        <h1 className="mt-2 font-heading text-2xl font-semibold text-zinc-900">
          {finished.passed ? "Nice work!" : "Keep going"}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          You got {finished.correct} of {finished.total} ({finished.percent}%).
          {finished.passed
            ? finished.mastered
              ? " All three stages complete — words, sentences, and conversation."
              : finished.stageCleared
                ? ` Stage cleared — moving on to stage ${finished.stage}.`
                : " Level up — keep going in this stage."
            : ` Need ${spec.passThreshold}% to level up.`}
        </p>
        <div className="mt-8 flex flex-col gap-3">
          {finished.passed && !finished.mastered ? (
            <button
              type="button"
              onClick={() => {
                router.replace(
                  `/dashboard/learn/free/${lessonId}/practice?n=${finished.masteryLevel}`
                );
              }}
              className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500"
            >
              Next activity →
            </button>
          ) : null}
          {!finished.passed ? (
            <button
              type="button"
              onClick={restartActivity}
              className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500"
            >
              Try again
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => router.push(`/dashboard/learn/free/${lessonId}`)}
            className="rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            Back to topic
          </button>
          <button
            type="button"
            onClick={() => router.replace("/dashboard/learn/free")}
            className="text-sm font-medium text-zinc-500 hover:text-zinc-800"
          >
            All topics
          </button>
        </div>
      </div>
    );
  }

  if (pending && !finished) {
    // Still showing game until save returns — optional overlay
  }

  if (error) {
    return <p className="text-center text-sm text-rose-600">{error}</p>;
  }

  const kind =
    spec.kind === "speak" && !speakReady ? ("tiles" as const) : spec.kind;

  if (kind === "match") {
    return (
      <TopicMatchActivity
        key={runKey}
        cards={cards}
        itemCount={spec.itemCount}
        passThreshold={spec.passThreshold}
        title={spec.title}
        subtitle={spec.subtitle}
        onComplete={handleComplete}
      />
    );
  }

  if (kind === "speed_quiz") {
    return (
      <TopicSpeedQuizActivity
        key={runKey}
        cards={cards}
        itemCount={spec.itemCount}
        passThreshold={spec.passThreshold}
        title={spec.title}
        subtitle={spec.subtitle}
        reverse={Boolean(spec.reverseQuiz)}
        onComplete={handleComplete}
      />
    );
  }

  if (kind === "speak") {
    return (
      <TopicSpeakActivity
        key={runKey}
        cards={cards}
        itemCount={spec.itemCount}
        passThreshold={spec.passThreshold}
        title={spec.title}
        subtitle={spec.subtitle}
        onComplete={handleComplete}
      />
    );
  }

  return (
    <TopicTilesActivity
      key={runKey}
      cards={cards}
      itemCount={spec.itemCount}
      passThreshold={spec.passThreshold}
      title={spec.title}
      subtitle={spec.subtitle}
      encourageListen={spec.stage === 2 && spec.depth >= 3}
      onComplete={handleComplete}
    />
  );
}
