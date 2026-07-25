"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { TopicActivity } from "@/lib/free-lessons/build-activity";
import { completeTopicActivity } from "@/app/dashboard/learn/free/actions";
import { PunjabiWithRomanisation } from "@/components/learn/punjabi-with-romanisation";
import { TopicListenButton } from "@/components/learn/topic-listen-button";
import { containsGurmukhi } from "@/lib/free-lessons/topic-game-utils";

type TopicPracticeSessionProps = {
  lessonId: string;
  topicTitle: string;
  activity: TopicActivity;
};

export function TopicPracticeSession({
  lessonId,
  topicTitle,
  activity,
}: TopicPracticeSessionProps) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<
    Array<{ correctIndex: number; chosenIndex: number }>
  >([]);
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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function restartActivity() {
    setFinished(null);
    setError(null);
    setIndex(0);
    setSelected(null);
    setRevealed(false);
    setAnswers([]);
  }

  const question = activity.questions[index];

  function selectOption(optionIndex: number) {
    if (revealed || !question) return;
    setSelected(optionIndex);
  }

  function checkAnswer() {
    if (selected === null || revealed) return;
    setRevealed(true);
  }

  function goNext() {
    if (selected === null || !question) return;
    const nextAnswers = [
      ...answers,
      { correctIndex: question.correctIndex, chosenIndex: selected },
    ];
    setAnswers(nextAnswers);

    if (index + 1 < activity.questions.length) {
      setIndex((value) => value + 1);
      setSelected(null);
      setRevealed(false);
      return;
    }

    const correct = nextAnswers.filter(
      (row) => row.chosenIndex === row.correctIndex
    ).length;
    const total = nextAnswers.length;
    const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
    const passed = percent >= activity.passThreshold;

    startTransition(async () => {
      try {
        const result = await completeTopicActivity({
          lessonId,
          passed,
          scorePercent: percent,
        });
        setFinished({
          percent,
          passed,
          correct,
          total,
          masteryLevel: result.masteryLevel,
          mastered: result.mastered,
          stageCleared: result.stageCleared,
          stage: result.stage,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save progress.");
      }
    });
  }

  if (finished) {
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {activity.title}
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
            : ` Need ${activity.passThreshold}% to level up.`}
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

  if (!question) {
    return (
      <p className="text-sm text-zinc-500">No questions available for this topic yet.</p>
    );
  }

  return (
    <div className="mx-auto max-w-md text-center">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {topicTitle}
        </p>
        <h1 className="mt-1 font-heading text-xl font-semibold text-zinc-900">
          {activity.title}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{activity.subtitle}</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-violet-500 transition-all duration-300"
            style={{
              width: `${((index + (revealed ? 1 : 0)) / activity.questions.length) * 100}%`,
            }}
          />
        </div>
        <p className="mt-1.5 text-xs text-zinc-400">
          {index + 1} of {activity.questions.length} · Pass at {activity.passThreshold}%
        </p>
      </div>

      <div className="rounded-3xl border border-zinc-200 bg-white px-5 py-6 text-center shadow-sm">
        <div className="flex items-start justify-center gap-2">
          <div className="min-w-0">
            {containsGurmukhi(question.prompt) ? (
              <PunjabiWithRomanisation
                gurmukhi={question.prompt}
                romanised={question.promptHint}
                textClassName="block text-lg font-semibold text-zinc-900"
                romanisedClassName="mt-1 block text-sm font-normal text-violet-600"
              />
            ) : (
              <>
                <p className="text-lg font-semibold text-zinc-900">{question.prompt}</p>
                {question.promptHint ? (
                  <p className="mt-1 text-sm text-zinc-500">{question.promptHint}</p>
                ) : null}
              </>
            )}
          </div>
          {question.audioUrl ? (
            <TopicListenButton
              audioUrl={question.audioUrl}
              label="Play pronunciation"
              className="mt-0.5"
            />
          ) : null}
        </div>

        <ul className="mt-5 space-y-2.5">
          {question.options.map((option, optionIndex) => {
            const isSelected = selected === optionIndex;
            const isCorrect = optionIndex === question.correctIndex;
            let style =
              "border-zinc-200 bg-zinc-50 hover:border-zinc-300 hover:bg-white";
            if (revealed && isCorrect) {
              style = "border-emerald-400 bg-emerald-50 text-emerald-900";
            } else if (revealed && isSelected && !isCorrect) {
              style = "border-rose-300 bg-rose-50 text-rose-900";
            } else if (!revealed && isSelected) {
              style = "border-violet-400 bg-violet-50 text-violet-900";
            }

            return (
              <li key={`${question.id}-${optionIndex}`}>
                <button
                  type="button"
                  disabled={revealed}
                  onClick={() => selectOption(optionIndex)}
                  className={`w-full rounded-2xl border px-4 py-3 text-center text-sm font-medium transition disabled:cursor-default ${style}`}
                >
                  {containsGurmukhi(option.text) ? (
                    <PunjabiWithRomanisation
                      gurmukhi={option.text}
                      romanised={option.romanised}
                    />
                  ) : (
                    option.text
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {!revealed ? (
          <button
            type="button"
            disabled={selected === null}
            onClick={checkAnswer}
            className="mt-5 w-full rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            Check answer
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={goNext}
            className="mt-5 w-full rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
          >
            {pending
              ? "Saving…"
              : index + 1 < activity.questions.length
                ? "Continue"
                : "See results"}
          </button>
        )}

        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      </div>
    </div>
  );
}
