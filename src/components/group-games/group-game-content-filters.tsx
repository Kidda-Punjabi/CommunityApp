"use client";

import { useMemo } from "react";
import type { TopicOption } from "@/lib/group-games/load-topic-options";
import { ui } from "@/lib/ui/styles";

type GroupGameTopicPickerProps = {
  options: TopicOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

export function GroupGameTopicPicker({
  options,
  selectedIds,
  onChange,
}: GroupGameTopicPickerProps) {
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = selectedIds.length === 0;

  function toggle(id: string) {
    if (selected.has(id)) {
      onChange(selectedIds.filter((tag) => tag !== id));
      return;
    }
    onChange([...selectedIds, id]);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Topics</p>
      <p className="text-sm text-zinc-500">
        Leave all unselected for a mixed pool, or pick one or more topics.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange([])}
          className={allSelected ? ui.pillActive : ui.pillInactive}
        >
          All topics
        </button>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => toggle(option.id)}
            className={selected.has(option.id) ? ui.pillActive : ui.pillInactive}
          >
            {option.label}
          </button>
        ))}
      </div>
      {!allSelected ? (
        <p className="text-xs text-zinc-500">
          {selectedIds.length} topic{selectedIds.length === 1 ? "" : "s"} selected
        </p>
      ) : null}
      {options.length === 0 ? (
        <p className="text-sm text-amber-700">No topic tags found on content yet.</p>
      ) : null}
    </div>
  );
}

/**
 * Kept for reinstatement once content is backfilled across difficulties 1–5.
 * Not wired into GroupGamesHub while the pool is mostly difficulty 1 / unset.
 */
export function GroupGameDifficultyRangePicker({
  min,
  max,
  onChange,
}: {
  min: number;
  max: number;
  onChange: (next: { min: number; max: number }) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Difficulty range
      </p>
      <p className="text-sm text-zinc-500">
        Cards from level {min} to {max} (1 easiest, 5 hardest).
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1.5 text-sm font-medium text-zinc-700">
          Min
          <select
            value={min}
            onChange={(event) => {
              const nextMin = Number.parseInt(event.target.value, 10);
              onChange({ min: Math.min(nextMin, max), max });
            }}
            className={ui.input}
          >
            {[1, 2, 3, 4, 5].map((level) => (
              <option key={`min-${level}`} value={level} disabled={level > max}>
                {level}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-sm font-medium text-zinc-700">
          Max
          <select
            value={max}
            onChange={(event) => {
              const nextMax = Number.parseInt(event.target.value, 10);
              onChange({ min, max: Math.max(nextMax, min) });
            }}
            className={ui.input}
          >
            {[1, 2, 3, 4, 5].map((level) => (
              <option key={`max-${level}`} value={level} disabled={level < min}>
                {level}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
