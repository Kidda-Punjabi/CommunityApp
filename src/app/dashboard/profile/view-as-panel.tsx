"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PaidCourseTier } from "@/lib/membership/access";
import { VIEW_AS_TIER_OPTIONS } from "@/lib/membership/view-as";
import {
  resetViewAsCourses,
  setViewAsCourses,
} from "./view-as-actions";

type ViewAsPanelProps = {
  initialTiers: PaidCourseTier[];
  isOverrideActive: boolean;
};

export function ViewAsPanel({ initialTiers, isOverrideActive }: ViewAsPanelProps) {
  const [selected, setSelected] = useState<Set<PaidCourseTier>>(
    () => new Set(initialTiers)
  );
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggleTier(tier: PaidCourseTier) {
    const next = new Set(selected);
    if (next.has(tier)) next.delete(tier);
    else next.add(tier);

    setSelected(next);

    startTransition(async () => {
      await setViewAsCourses([...next]);
      router.refresh();
    });
  }

  function handleReset() {
    setSelected(new Set());

    startTransition(async () => {
      await resetViewAsCourses();
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl bg-violet-50 p-5 shadow-sm ring-1 ring-violet-200/80">
      <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
        Test as
      </p>
      <p className="mt-2 text-sm text-zinc-600">
        Preview locks and unlocks for any course combination. Free content always
        stays available. This does not change your real purchases.
      </p>

      <div className="mt-4 space-y-2">
        {VIEW_AS_TIER_OPTIONS.map((option) => (
          <label
            key={option.tier}
            className="flex items-center gap-3 rounded-xl border border-violet-200 bg-white px-4 py-3"
          >
            <input
              type="checkbox"
              checked={selected.has(option.tier)}
              disabled={pending}
              onChange={() => toggleTier(option.tier)}
              className="h-4 w-4 rounded border-violet-300 text-violet-600"
            />
            <span className="text-sm font-medium text-zinc-900">{option.label}</span>
          </label>
        ))}
      </div>

      {isOverrideActive && (
        <button
          type="button"
          onClick={handleReset}
          disabled={pending}
          className="mt-4 text-sm font-semibold text-violet-700 hover:text-violet-600 disabled:opacity-50"
        >
          Reset to real account access
        </button>
      )}
    </div>
  );
}
