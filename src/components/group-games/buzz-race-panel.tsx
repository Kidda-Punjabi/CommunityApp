"use client";

import type { BuzzRacePhase, McqQuestionPayload } from "@/lib/group-games/buzz-race-types";
import { mcqOptionRomanised } from "@/components/group-games/mcq-option-label";
import { latinRomanised } from "@/lib/conjugation/romanised";
import { splitBilingual } from "@/lib/group-games/split-bilingual";
import {
  BUZZ_RACE_ANSWER_WINDOW_MS,
  BUZZ_RACE_BUZZ_WINDOW_MS,
} from "@/lib/group-games/buzz-race-constants";
import { useEffect, useState, type ReactNode } from "react";

type BuzzRacePanelProps = {
  question: McqQuestionPayload;
  phase: BuzzRacePhase;
  isPlaying: boolean;
  isBuzzer: boolean;
  buzzerDisplayName: string;
  buzzedBy: string | null;
  /** When the buzz landed, so the buzzer sees how long they have left. */
  buzzedAt?: string | null;
  /** When the question opened, for the "to buzz" countdown. */
  openedAt?: string | null;
  /** What the buzzer picked, shown on the result. */
  answerGiven?: string | null;
  answerCorrect: boolean | null;
  /** e.g. "+100 points"; games with varying points leave it out. */
  pointsLabel?: string | null;
  pending: boolean;
  onBuzz: () => void;
  onAnswer: (answer: string) => void;
  /** Bumped by the parent when sending an answer failed, so the buzzer can try again. */
  answerAttempt?: number;
};

function useSecondsLeft(
  startedAt: string | null | undefined,
  windowMs: number,
  active: boolean
): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active || !startedAt) return;
    // Tick once straight away so a new timer never shows a stale number.
    const first = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [active, startedAt]);
  if (!active || !startedAt) return null;
  const deadline = new Date(startedAt).getTime() + windowMs;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

function promptLabel(question: McqQuestionPayload): string {
  if (question.kind === "sentence") return "Translate this sentence";
  if (question.kind === "number") return "Translate this number";
  if (question.kind === "word") return "Translate this word";
  return "Translate";
}

function sameAnswer(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.trim() === b.trim();
}

type OptionState = "idle" | "sent" | "correct" | "wrong" | "faded";

function OptionRow({
  question,
  option,
  letter,
  state,
  tag,
  disabled,
  onPick,
}: {
  question: McqQuestionPayload;
  option: string;
  letter: string;
  state: OptionState;
  tag?: string | null;
  disabled: boolean;
  onPick?: () => void;
}) {
  const { main, bracketLatin } = splitBilingual(option);
  const latin = latinRomanised(mcqOptionRomanised(question, option)) ?? bracketLatin;

  const rowClass = {
    idle: "border-zinc-200 bg-white enabled:hover:border-violet-300 enabled:active:bg-violet-50",
    sent: "border-violet-600 bg-violet-50",
    correct: "border-emerald-600 bg-emerald-50",
    wrong: "border-rose-600 bg-rose-50",
    faded: "border-zinc-200 bg-white opacity-55",
  }[state];
  const badgeClass = {
    idle: "border-2 border-zinc-300 text-zinc-600",
    sent: "bg-violet-600 text-white",
    correct: "bg-emerald-600 text-white",
    wrong: "bg-rose-600 text-white",
    faded: "border-2 border-zinc-300 text-zinc-600",
  }[state];
  const mark = state === "correct" || state === "sent" ? "✓" : state === "wrong" ? "✕" : letter;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      className={`flex min-h-16 w-full items-center gap-3.5 rounded-2xl border-2 px-3.5 py-2.5 text-left transition-colors disabled:cursor-default ${rowClass}`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold ${badgeClass}`}
        aria-hidden="true"
      >
        {mark}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        {state === "sent" ? <span className="sr-only">Your answer, sent: </span> : null}
        <span
          className={`font-semibold leading-snug text-zinc-900 ${
            question.kind === "sentence" ? "text-lg" : "text-xl"
          }`}
        >
          {main}
        </span>
        {latin ? <span className="text-sm font-medium text-zinc-600">{latin}</span> : null}
      </span>
      {tag ? (
        <span
          className={`shrink-0 rounded-[10px] px-2 py-1 text-xs font-bold ${
            state === "correct" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
          }`}
        >
          {tag}
        </span>
      ) : null}
    </button>
  );
}

function TimerRing({ seconds, label }: { seconds: number; label: string }) {
  return (
    <span
      role="timer"
      aria-label={label}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[3px] bg-white text-[15px] font-extrabold tabular-nums ${
        seconds <= 5 ? "border-rose-500 text-rose-700" : "border-violet-600 text-violet-700"
      }`}
    >
      {seconds}
    </span>
  );
}

export function BuzzRacePanel({
  question,
  phase,
  isPlaying,
  isBuzzer,
  buzzerDisplayName,
  buzzedBy,
  buzzedAt = null,
  openedAt = null,
  answerGiven = null,
  answerCorrect,
  pointsLabel = null,
  pending,
  onBuzz,
  onAnswer,
  answerAttempt = 0,
}: BuzzRacePanelProps) {
  // Tapping an option sends it straight away: the window is short, so no separate Submit.
  // Keyed to the question + phase so a new round starts fresh without an effect.
  const roundKey = `${question.prompt}|${phase}|${answerAttempt}`;
  const [sentFor, setSentFor] = useState<{ key: string; option: string } | null>(null);
  const sent = sentFor?.key === roundKey ? sentFor.option : null;
  const answerSeconds = useSecondsLeft(buzzedAt, BUZZ_RACE_ANSWER_WINDOW_MS, phase === "buzzed");
  const buzzSeconds = useSecondsLeft(openedAt, BUZZ_RACE_BUZZ_WINDOW_MS, phase === "open");

  function handlePick(option: string) {
    if (pending || sent) return;
    setSentFor({ key: roundKey, option });
    onAnswer(option);
  }

  const letters = ["A", "B", "C", "D", "E", "F"];
  const showOptions = phase === "buzzed" || phase === "result";

  function stateFor(option: string): { state: OptionState; tag: string | null } {
    if (phase === "result") {
      if (sameAnswer(option, question.correct_answer)) return { state: "correct", tag: "Correct" };
      if (sameAnswer(option, answerGiven)) {
        return { state: "wrong", tag: isBuzzer ? "Your answer" : `${buzzerDisplayName}'s answer` };
      }
      return { state: "faded", tag: null };
    }
    if (sent === option) return { state: "sent", tag: null };
    return { state: "idle", tag: null };
  }

  let banner: ReactNode = null;
  if (phase === "buzzed") {
    banner = (
      <div aria-live="polite" className="flex items-center justify-between gap-3 rounded-2xl bg-violet-50 py-2 pl-3.5 pr-2">
        <span className="text-[15px] font-bold text-violet-700">
          {isBuzzer
            ? sent
              ? "Answer sent…"
              : "You buzzed in. Tap your answer."
            : `${buzzerDisplayName} buzzed in…`}
        </span>
        {answerSeconds != null ? (
          <TimerRing seconds={answerSeconds} label={`${answerSeconds} seconds left`} />
        ) : null}
      </div>
    );
  } else if (phase === "result") {
    const tone =
      answerCorrect === true
        ? "bg-emerald-50 text-emerald-800"
        : buzzedBy
          ? "bg-rose-50 text-rose-700"
          : "bg-zinc-100 text-zinc-700";
    const headline = !buzzedBy
      ? "No one buzzed in time"
      : answerCorrect
        ? isBuzzer
          ? "Correct!"
          : `${buzzerDisplayName} got it right`
        : isBuzzer
          ? "Not quite"
          : `${buzzerDisplayName} didn't get it`;
    const detail = !buzzedBy
      ? "Here's the answer"
      : answerCorrect
        ? pointsLabel
          ? isBuzzer
            ? pointsLabel
            : `${pointsLabel} to them`
          : "Nice one"
        : answerGiven
          ? "No points this time"
          : "Ran out of time";
    banner = (
      <div aria-live="polite" className={`flex flex-col gap-0.5 rounded-2xl px-3.5 py-3 ${tone}`}>
        <span className="text-base font-extrabold">{headline}</span>
        <span className="text-[13px] font-semibold text-zinc-600">{detail}</span>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-[28px] bg-white px-4 pb-4 pt-6 shadow-sm">
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-zinc-600">
          {promptLabel(question)}
        </p>
        <p
          className={`font-extrabold leading-snug text-zinc-900 ${
            question.kind === "sentence" ? "text-[26px]" : "text-[32px]"
          }`}
        >
          {question.prompt}
        </p>
      </div>

      {phase === "open" && isPlaying ? (
        <div className="flex flex-col items-center gap-4 py-4">
          <button
            type="button"
            onClick={onBuzz}
            disabled={pending}
            className="h-24 w-full rounded-full bg-amber-400 text-[28px] font-extrabold text-amber-950 shadow-[0_8px_24px_rgba(251,191,36,0.35)] transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            BUZZ!
          </button>
          <span className="text-sm font-semibold text-zinc-600">
            First to buzz answers{buzzSeconds != null ? ` · ${buzzSeconds}s to buzz` : ""}
          </span>
        </div>
      ) : null}

      {phase === "open" && !isPlaying ? (
        <p className="py-6 text-center text-sm text-zinc-600">
          You&apos;re spectating, waiting for a buzz…
        </p>
      ) : null}

      {banner}

      {showOptions ? (
        <div className="flex flex-col gap-2">
          {question.options.map((option, index) => {
            const { state, tag } = stateFor(option);
            const canPick = phase === "buzzed" && isBuzzer && !sent && !pending;
            return (
              <OptionRow
                key={option}
                question={question}
                option={option}
                letter={letters[index] ?? ""}
                state={state}
                tag={tag}
                disabled={!canPick}
                onPick={canPick ? () => handlePick(option) : undefined}
              />
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
