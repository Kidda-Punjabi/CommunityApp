"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { GrammarTenseFilterPicker } from "@/components/games/grammar-tense-filter-picker";
import { GAMES_HUB_HREF } from "@/lib/games/catalog";
import {
  isMixedFilter,
  QUESTION_COUNT_OPTIONS,
  repeatPoolWarning,
  type GameSessionSettingsChoice,
  type QuestionCount,
} from "@/lib/games/session-settings";
import { ui } from "@/lib/ui/styles";

export type SessionFilterOption = {
  id: string;
  label: string;
};

type GameSessionSettingsProps = {
  gameTitle: string;
  gameEyebrow?: string;
  gameDescription: string;
  filterLabel: string;
  /** Flat pill list (e.g. Gender Sort categories). */
  filterOptions?: SessionFilterOption[];
  /** Grouped multi-select tense picker (Sentence Builder / Conjugation Challenge). */
  tenseFilterValues?: string[];
  poolSizeForFilter: (filterIds: string[]) => number;
  repeatUnit?: "sentence" | "noun";
  /** When `cap`, fewer questions are played instead of repeating content. */
  repeatPolicy?: "cycle" | "cap";
  canStart: boolean;
  unavailableMessage?: React.ReactNode;
  extraSettings?: React.ReactNode;
  onStart: (choice: GameSessionSettingsChoice) => void;
  gamesHubHref?: string;
};

export function GameSessionSettings({
  gameTitle,
  gameEyebrow,
  gameDescription,
  filterLabel,
  filterOptions,
  tenseFilterValues,
  poolSizeForFilter,
  repeatUnit = "sentence",
  repeatPolicy = "cycle",
  canStart,
  unavailableMessage,
  extraSettings,
  onStart,
  gamesHubHref = GAMES_HUB_HREF,
}: GameSessionSettingsProps) {
  const [questionCount, setQuestionCount] = useState<QuestionCount>(10);
  const [isMixed, setIsMixed] = useState(true);
  const [selectedFilterIds, setSelectedFilterIds] = useState<string[]>([]);
  const [flatFilterId, setFlatFilterId] = useState(filterOptions?.[0]?.id ?? "all");

  const activeFilterIds = useMemo(() => {
    if (tenseFilterValues) {
      return isMixed ? ["mixed"] : selectedFilterIds;
    }
    return [flatFilterId];
  }, [tenseFilterValues, isMixed, selectedFilterIds, flatFilterId]);

  const poolSize = useMemo(
    () => poolSizeForFilter(activeFilterIds),
    [activeFilterIds, poolSizeForFilter]
  );
  const repeatWarning =
    repeatPolicy === "cycle"
      ? repeatPoolWarning(poolSize, questionCount, repeatUnit)
      : poolSize > 0 && questionCount > poolSize
        ? `Only ${poolSize} ${repeatUnit === "noun" ? (poolSize === 1 ? "noun" : "nouns") : poolSize === 1 ? "sentence" : "sentences"} match — you'll play ${poolSize}.`
        : null;
  const startDisabled =
    !canStart ||
    poolSize === 0 ||
    (Boolean(tenseFilterValues) && !isMixed && selectedFilterIds.length === 0);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={gamesHubHref}
          className="text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          ← Back to games
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-violet-600">
          {gameEyebrow ?? gameTitle}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">{gameTitle}</h1>
        <p className="mt-2 text-sm text-zinc-500">{gameDescription}</p>
      </div>

      {unavailableMessage ? (
        unavailableMessage
      ) : (
        <>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Number of questions
            </p>
            <div className="flex flex-wrap gap-2">
              {QUESTION_COUNT_OPTIONS.map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setQuestionCount(count)}
                  className={
                    questionCount === count ? ui.pillActive : ui.pillInactive
                  }
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          {extraSettings}

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              {filterLabel}
            </p>
            {tenseFilterValues ? (
              <GrammarTenseFilterPicker
                availableTenseValues={tenseFilterValues}
                selectedTenseIds={selectedFilterIds}
                isMixed={isMixed}
                onMixedChange={setIsMixed}
                onSelectionChange={setSelectedFilterIds}
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {filterOptions?.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setFlatFilterId(option.id)}
                    className={flatFilterId === option.id ? ui.pillActive : ui.pillInactive}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {!isMixedFilter(activeFilterIds) && selectedFilterIds.length > 0 && (
            <p className="text-xs text-zinc-500">
              {selectedFilterIds.length} tense{selectedFilterIds.length === 1 ? "" : "s"} selected
            </p>
          )}

          {repeatWarning && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {repeatWarning}
            </p>
          )}

          {poolSize === 0 && (
            <p className="text-sm text-amber-700">
              No content available for this selection yet.
            </p>
          )}

          <button
            type="button"
            onClick={() =>
              onStart({
                questionCount,
                filterIds: activeFilterIds,
              })
            }
            disabled={startDisabled}
            className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            Start
          </button>
        </>
      )}
    </div>
  );
}
