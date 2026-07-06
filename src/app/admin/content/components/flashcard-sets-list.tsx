"use client";

import { useEffect, useMemo, useState } from "react";
import type { FlashcardSet, FlashcardSetCourseAssociation } from "../types";
import {
  buildFlashcardSetSections,
  defaultExpandedSectionKey,
  defaultExpandedWeekNumber,
  type FlashcardSetWeekGroup,
} from "@/lib/admin/flashcard-set-groups";
import { dangerButtonClass, inputClass, secondaryButtonClass } from "./ui";

type FlashcardSetsListProps = {
  sets: FlashcardSet[];
  cardCountBySet: Map<string, number>;
  onEdit: (setId: string) => void;
  onDelete: (id: string, name: string) => void;
};

function weekGroupKey(weekNumber: number | null): string {
  return weekNumber === null ? "unassigned" : `week-${weekNumber}`;
}

export function FlashcardSetsList({
  sets,
  cardCountBySet,
  onEdit,
  onDelete,
}: FlashcardSetsListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState<
    Set<FlashcardSetCourseAssociation>
  >(() => {
    const key = defaultExpandedSectionKey(sets);
    return key ? new Set([key]) : new Set();
  });
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(() => {
    const week = defaultExpandedWeekNumber(sets);
    return week !== null ? new Set([weekGroupKey(week)]) : new Set();
  });

  const sections = useMemo(
    () => buildFlashcardSetSections(sets, searchQuery),
    [sets, searchQuery]
  );

  const isSearching = searchQuery.trim().length > 0;

  useEffect(() => {
    if (!isSearching) return;
    setExpandedSections(new Set(sections.map((section) => section.key)));
    const beginners = sections.find((section) => section.key === "beginners");
    if (beginners?.weekGroups) {
      setExpandedWeeks(
        new Set(beginners.weekGroups.map((group) => weekGroupKey(group.weekNumber)))
      );
    }
  }, [isSearching, sections]);

  const totalVisible = sections.reduce((sum, section) => sum + section.sets.length, 0);

  const toggleSection = (key: FlashcardSetCourseAssociation) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleWeek = (weekKey: string) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekKey)) next.delete(weekKey);
      else next.add(weekKey);
      return next;
    });
  };

  if (sets.length === 0) {
    return <p className="text-sm text-zinc-500">No flashcard sets yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="sr-only" htmlFor="flashcard-set-search">
          Search flashcard sets
        </label>
        <input
          id="flashcard-set-search"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search sets by name…"
          className={inputClass}
        />
        {searchQuery.trim() && (
          <p className="mt-2 text-sm text-zinc-500">
            {totalVisible} matching set{totalVisible === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {sections.length === 0 ? (
        <p className="text-sm text-zinc-500">No sets match your search.</p>
      ) : (
        <div className="space-y-3">
          {sections.map((section) => {
            const isExpanded = expandedSections.has(section.key);
            const showUncategorizedBadge = section.key === "uncategorized";

            return (
              <div
                key={section.key}
                className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
              >
                <button
                  type="button"
                  onClick={() => toggleSection(section.key)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-50"
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-900">
                      {section.label} ({section.sets.length})
                    </span>
                    {showUncategorizedBadge && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        needs categorising
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-zinc-400">
                    {isExpanded ? "▾" : "▸"}
                  </span>
                </button>

                {isExpanded && (
                  <div className="border-t border-zinc-100">
                    {section.weekGroups ? (
                      <BeginnersWeekGroups
                        weekGroups={section.weekGroups}
                        expandedWeeks={expandedWeeks}
                        onToggleWeek={toggleWeek}
                        cardCountBySet={cardCountBySet}
                        onEdit={onEdit}
                        onDelete={onDelete}
                      />
                    ) : (
                      <SetRows
                        sets={section.sets}
                        cardCountBySet={cardCountBySet}
                        onEdit={onEdit}
                        onDelete={onDelete}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BeginnersWeekGroups({
  weekGroups,
  expandedWeeks,
  onToggleWeek,
  cardCountBySet,
  onEdit,
  onDelete,
}: {
  weekGroups: FlashcardSetWeekGroup[];
  expandedWeeks: Set<string>;
  onToggleWeek: (weekKey: string) => void;
  cardCountBySet: Map<string, number>;
  onEdit: (setId: string) => void;
  onDelete: (id: string, name: string) => void;
}) {
  return (
    <div className="divide-y divide-zinc-100">
      {weekGroups.map((group) => {
        const key = weekGroupKey(group.weekNumber);
        const isExpanded = expandedWeeks.has(key);

        return (
          <div key={key}>
            <button
              type="button"
              onClick={() => onToggleWeek(key)}
              className="flex w-full items-center justify-between gap-3 bg-zinc-50/80 px-4 py-2.5 text-left hover:bg-zinc-100/80"
            >
              <span className="text-sm font-medium text-zinc-700">
                {group.label} ({group.sets.length})
              </span>
              <span className="shrink-0 text-xs text-zinc-400">
                {isExpanded ? "▾" : "▸"}
              </span>
            </button>
            {isExpanded && (
              <SetRows
                sets={group.sets}
                cardCountBySet={cardCountBySet}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SetRows({
  sets,
  cardCountBySet,
  onEdit,
  onDelete,
}: {
  sets: FlashcardSet[];
  cardCountBySet: Map<string, number>;
  onEdit: (setId: string) => void;
  onDelete: (id: string, name: string) => void;
}) {
  return (
    <ul className="divide-y divide-zinc-100">
      {sets.map((set) => (
        <SetRow
          key={set.id}
          set={set}
          cardCount={cardCountBySet.get(set.id) ?? 0}
          onEdit={() => onEdit(set.id)}
          onDelete={() => onDelete(set.id, set.name)}
        />
      ))}
    </ul>
  );
}

function SetRow({
  set,
  cardCount,
  onEdit,
  onDelete,
}: {
  set: FlashcardSet;
  cardCount: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold text-zinc-900">{set.name}</p>
        {set.description && (
          <p className="mt-1 text-sm text-zinc-500">{set.description}</p>
        )}
        <p className="mt-1 text-xs text-zinc-400">
          {cardCount} card{cardCount === 1 ? "" : "s"}
        </p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onEdit} className={secondaryButtonClass}>
          Edit
        </button>
        <DeleteFlashcardSetButton onDelete={onDelete} />
      </div>
    </li>
  );
}

function DeleteFlashcardSetButton({ onDelete }: { onDelete: () => void }) {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      className={dangerButtonClass}
      onClick={async () => {
        setPending(true);
        await onDelete();
        setPending(false);
      }}
    >
      Delete
    </button>
  );
}
