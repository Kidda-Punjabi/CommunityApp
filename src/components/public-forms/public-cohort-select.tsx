"use client";

import { groupPublicCohortOptions } from "@/lib/public-forms/options";

export function PublicCohortSelect({
  id,
  value,
  onChange,
  cohorts,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  cohorts: readonly string[];
  placeholder?: string;
}) {
  const groups = groupPublicCohortOptions(cohorts);

  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
      required
    >
      <option value="">{placeholder ?? "Select your cohort"}</option>
      {groups.map((group) => (
        <optgroup key={group.id} label={group.label}>
          {group.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
