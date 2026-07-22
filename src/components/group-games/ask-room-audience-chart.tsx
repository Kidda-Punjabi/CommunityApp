"use client";

import { ChadoPauriGroupOptionLabel } from "@/components/group-games/chado-pauri-group-option-label";

const OPTION_LABELS = ["A", "B", "C", "D"] as const;

type AskRoomAudienceChartProps = {
  options: string[];
  tally: Record<string, number>;
  romanisedForOption: (option: string) => string | null;
};

export function AskRoomAudienceChart({
  options,
  tally,
  romanisedForOption,
}: AskRoomAudienceChartProps) {
  const maxPct = Math.max(...options.map((opt) => tally[opt] ?? 0), 1);

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/80 px-3 py-3">
      <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-violet-800">
        Ask the Room
      </p>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {options.map((option, index) => {
          const pct = tally[option] ?? 0;
          const heightPct = Math.max(8, Math.round((pct / maxPct) * 100));
          return (
            <div key={option} className="flex min-w-0 flex-col items-center">
              <span className="text-xs font-bold tabular-nums text-violet-900">{pct}%</span>
              <div className="mt-1 flex h-20 w-full items-end justify-center">
                <div
                  className="w-full max-w-[2.75rem] rounded-t-md bg-violet-500 transition-all"
                  style={{ height: `${heightPct}%` }}
                  aria-hidden
                />
              </div>
              <div className="mt-2 w-full text-center">
                <ChadoPauriGroupOptionLabel
                  gurmukhi={option}
                  romanised={romanisedForOption(option)}
                  label={OPTION_LABELS[index] ?? String(index + 1)}
                  className="text-left text-[11px] leading-tight"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
