"use client";

import { cn, ui } from "@/lib/ui/styles";

export type LessonsViewMode = "list" | "calendar";

type LessonsViewToggleProps = {
  mode: LessonsViewMode;
  onChange: (mode: LessonsViewMode) => void;
};

export function LessonsViewToggle({ mode, onChange }: LessonsViewToggleProps) {
  return (
    <div className="mb-4 flex gap-2">
      <button
        type="button"
        onClick={() => onChange("list")}
        className={cn(mode === "list" ? ui.pillActive : ui.pillInactive)}
      >
        List
      </button>
      <button
        type="button"
        onClick={() => onChange("calendar")}
        className={cn(mode === "calendar" ? ui.pillActive : ui.pillInactive)}
      >
        Calendar
      </button>
    </div>
  );
}
