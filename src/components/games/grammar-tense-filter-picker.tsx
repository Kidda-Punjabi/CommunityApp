"use client";

import { useMemo, useState } from "react";
import { buildGrammarTenseFilterGroups } from "@/lib/games/grammar-tense-filter-catalog";
import { ui } from "@/lib/ui/styles";

type GrammarTenseFilterPickerProps = {
  availableTenseValues: string[];
  selectedTenseIds: string[];
  isMixed: boolean;
  onMixedChange: (mixed: boolean) => void;
  onSelectionChange: (tenseIds: string[]) => void;
};

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className={`h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function GrammarTenseFilterPicker({
  availableTenseValues,
  selectedTenseIds,
  isMixed,
  onMixedChange,
  onSelectionChange,
}: GrammarTenseFilterPickerProps) {
  const groups = useMemo(
    () => buildGrammarTenseFilterGroups(availableTenseValues),
    [availableTenseValues]
  );
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  const selectedSet = useMemo(() => new Set(selectedTenseIds), [selectedTenseIds]);

  function toggleGroup(groupId: string) {
    setExpandedGroupId((current) => (current === groupId ? null : groupId));
  }

  function toggleTense(tenseId: string) {
    onMixedChange(false);
    const next = new Set(selectedTenseIds);
    if (next.has(tenseId)) {
      next.delete(tenseId);
    } else {
      next.add(tenseId);
    }

    if (next.size === 0) {
      onMixedChange(true);
      onSelectionChange([]);
      return;
    }

    onSelectionChange([...next]);
  }

  function selectMixed() {
    onMixedChange(true);
    onSelectionChange([]);
    setExpandedGroupId(null);
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={selectMixed}
        className={isMixed ? ui.pillActive : ui.pillInactive}
      >
        Mixed (all tenses)
      </button>

      {groups.map((group) => {
        const groupSelectionCount = group.tenses.filter((tense) =>
          selectedSet.has(tense.id)
        ).length;
        const expanded = expandedGroupId === group.id;
        const hasSelections = !isMixed && groupSelectionCount > 0;

        return (
          <div key={group.id} className="space-y-2">
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              aria-expanded={expanded}
              className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${
                hasSelections
                  ? "border-violet-300 bg-violet-50 text-violet-900"
                  : "border-zinc-200 bg-white text-zinc-800 shadow-sm hover:border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span>{group.label}</span>
                {hasSelections ? (
                  <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-violet-600 px-1.5 py-0.5 text-xs font-bold text-white">
                    {groupSelectionCount}
                  </span>
                ) : null}
              </span>
              <ChevronIcon expanded={expanded} />
            </button>

            {expanded ? (
              <div className="flex flex-wrap gap-2 pl-1">
                {group.tenses.map((tense) => {
                  const active = !isMixed && selectedSet.has(tense.id);
                  return (
                    <button
                      key={tense.id}
                      type="button"
                      onClick={() => toggleTense(tense.id)}
                      className={active ? ui.pillActive : ui.pillInactive}
                    >
                      {tense.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
