"use client";

import type { BattleQuestionPayload } from "@/lib/battle/types";
import { ui } from "@/lib/ui/styles";

type BattleQuestionPanelProps = {
  question: BattleQuestionPayload;
  disabled: boolean;
  onAnswer: (answer: string) => void;
};

function PunjabiOption({
  gurmukhi,
  romanised,
  onClick,
  disabled,
}: {
  gurmukhi: string;
  romanised: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${ui.cardBordered} w-full px-4 py-4 text-center transition-colors enabled:hover:border-violet-300 enabled:hover:bg-violet-50 disabled:opacity-60`}
    >
      <span className="block text-lg font-semibold text-zinc-900">{gurmukhi}</span>
      {romanised ? (
        <span className="mt-1 block text-sm font-medium text-violet-600">{romanised}</span>
      ) : null}
    </button>
  );
}

export function BattleQuestionPanel({ question, disabled, onAnswer }: BattleQuestionPanelProps) {
  if (question.type === "gender_sort") {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Masculine or feminine?
          </p>
          <p className="mt-3 text-3xl font-bold text-zinc-900">{question.punjabiWord}</p>
          {question.romanised ? (
            <p className="mt-1 text-2xl font-semibold text-violet-600">{question.romanised}</p>
          ) : null}
          <p className="mt-2 text-sm text-zinc-500">{question.englishMeaning}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAnswer("masculine")}
            className={`${ui.btnSecondary} w-full py-4 disabled:opacity-60`}
          >
            Masculine
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAnswer("feminine")}
            className={`${ui.btnSecondary} w-full py-4 disabled:opacity-60`}
          >
            Feminine
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Pick the correct verb form
        </p>
        <p className="mt-3 text-2xl font-bold leading-snug text-zinc-900">{question.prompt}</p>
        <p className="mt-2 text-sm text-zinc-500">{question.englishGloss}</p>
      </div>
      <div className="space-y-3">
        {question.options.map((option) => (
          <PunjabiOption
            key={option.gurmukhi}
            gurmukhi={option.gurmukhi}
            romanised={option.romanised}
            disabled={disabled}
            onClick={() => onAnswer(option.gurmukhi)}
          />
        ))}
      </div>
    </div>
  );
}
