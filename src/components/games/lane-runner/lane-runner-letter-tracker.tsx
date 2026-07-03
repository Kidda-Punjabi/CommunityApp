"use client";

import type { LetterSlot } from "@/lib/games/lane-runner/letter-tracker";

type LaneRunnerLetterTrackerProps = {
  slots: LetterSlot[];
};

export function LaneRunnerLetterTracker({ slots }: LaneRunnerLetterTrackerProps) {
  return (
    <div
      className="flex justify-center gap-1.5"
      aria-label="KIDDA letter collection progress"
    >
      {slots.map((slot, index) => (
        <div
          key={`${slot.letter}-${index}`}
          className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold ${
            slot.filled
              ? "border-2 border-violet-700 bg-violet-600 text-white"
              : "border-2 border-dashed border-violet-400 bg-transparent text-violet-500"
          }`}
        >
          {slot.letter}
        </div>
      ))}
    </div>
  );
}
