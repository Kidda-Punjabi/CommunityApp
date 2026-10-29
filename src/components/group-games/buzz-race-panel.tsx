"use client";

import type { BuzzRacePhase } from "@/lib/group-games/buzz-race-types";
import type { McqQuestionPayload } from "@/lib/group-games/buzz-race-types";
import { McqOptionLabel } from "@/components/group-games/mcq-option-label";
import { ChadoPauriGroupOptionLabel } from "@/components/group-games/chado-pauri-group-option-label";
import { BUZZ_RACE_ANSWER_WINDOW_MS } from "@/lib/group-games/buzz-race-constants";
import { ui } from "@/lib/ui/styles";
import { useEffect, useState } from "react";

type BuzzRacePanelProps = {
  question: McqQuestionPayload;
  phase: BuzzRacePhase;
  isPlaying: boolean;
  isBuzzer: boolean;
  buzzerDisplayName: string;
  buzzedBy: string | null;
  /** When the buzz landed, so the buzzer sees how long they have left. */
  buzzedAt?: string | null;
  answerCorrect: boolean | null;
  pending: boolean;
  onBuzz: () => void;
  onAnswer: (answer: string) => void;
};

function useSecondsLeft(buzzedAt: string | null | undefined, active: boolean): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active || !buzzedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [active, buzzedAt]);
  if (!active || !buzzedAt) return null;
  const deadline = new Date(buzzedAt).getTime() + BUZZ_RACE_ANSWER_WINDOW_MS;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function BuzzRacePanel({
  question,
  phase,
  isPlaying,
  isBuzzer,
  buzzerDisplayName,
  buzzedBy,
  buzzedAt = null,
  answerCorrect,
  pending,
  onBuzz,
  onAnswer,
}: BuzzRacePanelProps) {
  // The tapped option is sent straight away: the answer window is short, so there is
  // no separate Submit step and no artificial "checking" pause.
  // Keyed to the question + phase so a new round starts fresh without an effect.
  const roundKey = `${question.prompt}|${phase}`;
  const [sentFor, setSentFor] = useState<{ key: string; option: string } | null>(null);
  const sent = sentFor?.key === roundKey ? sentFor.option : null;
  const secondsLeft = useSecondsLeft(buzzedAt, phase === "buzzed");

  function handlePick(option: string) {
    if (pending || sent) return;
    setSentFor({ key: roundKey, option });
    onAnswer(option);
  }

  return (
    <section className={`${ui.card} space-y-6`}>
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Translate</p>
        <p className="mt-3 text-3xl font-bold leading-snug text-zinc-900">{question.prompt}</p>
      </div>

      {phase === "open" && isPlaying ? (
        <button
          type="button"
          onClick={onBuzz}
          disabled={pending}
          className="flex w-full items-center justify-center rounded-full bg-amber-400 py-5 text-xl font-bold text-amber-950 shadow-[0_4px_20px_-4px_rgba(251,191,36,0.7)] transition-transform enabled:hover:scale-[1.02] enabled:active:scale-[0.98] disabled:opacity-60"
        >
          {pending ? "Buzzing…" : "BUZZ!"}
        </button>
      ) : null}

      {phase === "open" && !isPlaying ? (
        <p className="text-center text-sm text-zinc-500">You&apos;re spectating, waiting for a buzz…</p>
      ) : null}

      {phase === "buzzed" && isBuzzer ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-violet-600">
              {sent ? "Answer sent…" : "You buzzed in. Tap your answer!"}
            </p>
            {secondsLeft != null ? (
              <span
                className={`inline-flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-base font-bold tabular-nums ${
                  secondsLeft <= 5 ? "bg-rose-100 text-rose-700" : "bg-violet-100 text-violet-700"
                }`}
                aria-label={`${secondsLeft} seconds left`}
              >
                {secondsLeft}s
              </span>
            ) : null}
          </div>
          <div className="grid gap-3">
            {question.options.map((option) => {
              const isSent = sent === option;
              return (
                <button
                  key={option}
                  type="button"
                  disabled={pending || Boolean(sent)}
                  onClick={() => handlePick(option)}
                  className={`${ui.cardBordered} w-full px-4 py-4 text-center text-lg transition-colors disabled:opacity-90 ${
                    isSent
                      ? "border-2 border-violet-600 bg-violet-50"
                      : "enabled:hover:border-violet-300 enabled:hover:bg-violet-50 enabled:active:bg-violet-100"
                  }`}
                >
                  <McqOptionLabel question={question} option={option} />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {phase === "buzzed" && !isBuzzer ? (
        <p className="rounded-2xl bg-violet-50 px-4 py-4 text-center text-sm font-medium text-violet-800">
          {buzzerDisplayName} buzzed in, waiting for their answer…
          {secondsLeft != null ? ` (${secondsLeft}s)` : ""}
        </p>
      ) : null}

      {phase === "result" ? (
        <div
          className={`space-y-3 rounded-2xl px-4 py-5 text-center ${
            answerCorrect === true
              ? "bg-emerald-50"
              : answerCorrect === false
                ? "bg-rose-50"
                : "bg-zinc-50"
          }`}
        >
          {buzzedBy ? (
            <p className="text-sm font-medium text-zinc-700">
              {buzzerDisplayName} {answerCorrect ? "got it right!" : "didn't get it."}
            </p>
          ) : (
            <p className="text-sm font-medium text-zinc-700">No one buzzed in time.</p>
          )}
          <p className="text-sm text-zinc-500">
            Correct answer:{" "}
            <span className="inline-block font-semibold text-zinc-900">
              <ChadoPauriGroupOptionLabel
                gurmukhi={question.correct_answer}
                romanised={
                  question.options_romanised?.[
                    question.options.indexOf(question.correct_answer)
                  ] ?? null
                }
              />
            </span>
          </p>
        </div>
      ) : null}
    </section>
  );
}
