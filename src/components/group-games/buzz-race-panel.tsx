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
  // Tap an option to select it (Point Race style), then press Submit to send it.
  // Keyed to the question + phase so a new round starts fresh without an effect.
  const roundKey = `${question.prompt}|${phase}`;
  const [selectedFor, setSelectedFor] = useState<{ key: string; option: string } | null>(null);
  const [sentFor, setSentFor] = useState<{ key: string; option: string } | null>(null);
  const selected = selectedFor?.key === roundKey ? selectedFor.option : null;
  const sent = sentFor?.key === roundKey ? sentFor.option : null;
  const secondsLeft = useSecondsLeft(buzzedAt, phase === "buzzed");

  function handleSelect(option: string) {
    if (pending || sent) return;
    setSelectedFor({ key: roundKey, option });
  }

  function handleSubmit() {
    if (pending || sent || !selected) return;
    setSentFor({ key: roundKey, option: selected });
    onAnswer(selected);
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
              {sent ? "Answer sent…" : "You buzzed in. Pick your answer, then submit!"}
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
          <div className="grid gap-3" role="radiogroup" aria-label="Answer options">
            {question.options.map((option, optionIndex) => {
              const isSelected = (sent ?? selected) === option;
              // Same look as Point Race: explicit per-state classes (no shared card base)
              // so the selected colours are never overridden by a white background or grey border.
              const stateClass = isSelected
                ? "border-violet-600 bg-violet-100 ring-2 ring-violet-300"
                : "border-zinc-200 bg-white enabled:hover:border-violet-300 enabled:hover:bg-violet-50";
              const badgeClass = isSelected
                ? "border-violet-600 bg-violet-600 text-white"
                : "border-zinc-300 bg-white text-zinc-500";
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={pending || Boolean(sent)}
                  onClick={() => handleSelect(option)}
                  className={`flex w-full items-center gap-4 rounded-2xl border-2 px-4 py-3 text-left transition-colors disabled:opacity-100 ${stateClass}`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${badgeClass}`}
                  >
                    {isSelected ? "✓" : String.fromCharCode(65 + optionIndex)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <McqOptionLabel question={question} option={option} />
                  </span>
                </button>
              );
            })}
          </div>
          {!sent ? (
            <button
              type="button"
              disabled={!selected || pending}
              onClick={handleSubmit}
              className={ui.btnPrimaryBlock}
            >
              Submit answer
            </button>
          ) : null}
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
