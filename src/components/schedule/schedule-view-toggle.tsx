"use client";

import { cn, ui } from "@/lib/ui/styles";

export type ScheduleViewMode = "day" | "week" | "list";

type ScheduleViewToggleProps = {
  mode: ScheduleViewMode;
  onChange: (mode: ScheduleViewMode) => void;
};

const MODES: { id: ScheduleViewMode; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "list", label: "List" },
];

export function ScheduleViewToggle({ mode, onChange }: ScheduleViewToggleProps) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {MODES.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={cn(mode === item.id ? ui.pillActive : ui.pillInactive)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
