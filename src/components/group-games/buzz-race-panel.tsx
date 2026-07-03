"use client";

import type { BuzzRacePhase } from "@/lib/group-games/buzz-race-types";
import type { McqQuestionPayload } from "@/lib/group-games/buzz-race-types";
import { ui } from "@/lib/ui/styles";

type BuzzRacePanelProps = {
  question: McqQuestionPayload;
  phase: BuzzRacePhase;
  isPlaying: boolean;
  isBuzzer: boolean;
  buzzerDisplayName: string;
  buzzedBy: string | null;
  answerCorrect: boolean | null;
  pending: boolean;
  onBuzz: () => void;
  onAnswer: (answer: string) => void;
};

export function BuzzRacePanel({
  question,
  phase,
  isPlaying,
  isBuzzer,
  buzzerDisplayName,
  buzzedBy,
  answerCorrect,
  pending,
  onBuzz,
  onAnswer,
}: BuzzRacePanelProps) {
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
        <p className="text-center text-sm text-zinc-500">You&apos;re spectating — waiting for a buzz…</p>
      ) : null}

      {phase === "buzzed" && isBuzzer ? (
        <div className="space-y-3">
          <p className="text-center text-sm font-semibold text-violet-600">
            You buzzed in — pick an answer!
          </p>
          <div className="grid gap-3">
            {question.options.map((option) => (
              <button
                key={option}
                type="button"
                disabled={pending}
                onClick={() => onAnswer(option)}
                className={`${ui.cardBordered} w-full px-4 py-4 text-center text-lg font-semibold text-zinc-900 transition-colors enabled:hover:border-violet-300 enabled:hover:bg-violet-50 disabled:opacity-60`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {phase === "buzzed" && !isBuzzer ? (
        <p className="rounded-2xl bg-violet-50 px-4 py-4 text-center text-sm font-medium text-violet-800">
          {buzzerDisplayName} buzzed in — waiting for their answer…
        </p>
      ) : null}

      {phase === "result" ? (
        <div className="space-y-3 rounded-2xl bg-zinc-50 px-4 py-5 text-center">
          {buzzedBy ? (
            <p className="text-sm font-medium text-zinc-700">
              {buzzerDisplayName} {answerCorrect ? "got it right!" : "didn't get it."}
            </p>
          ) : (
            <p className="text-sm font-medium text-zinc-700">No one buzzed in time.</p>
          )}
          <p className="text-sm text-zinc-500">
            Correct answer:{" "}
            <span className="font-semibold text-zinc-900">{question.correct_answer}</span>
          </p>
        </div>
      ) : null}
    </section>
  );
}
