"use client";

import { cn } from "@/lib/ui/styles";

type EnglishBilingualToggleProps = {
  showEnglish: boolean;
  onChange: (showEnglish: boolean) => void;
  className?: string;
};

/**
 * English on/off for practice + mock.
 * Default ON = Punjabi + English. Off = Punjabi-only.
 */
export function EnglishBilingualToggle({
  showEnglish,
  onChange,
  className,
}: EnglishBilingualToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700",
        className
      )}
    >
      <span className="text-zinc-500">English</span>
      <button
        type="button"
        role="switch"
        aria-checked={showEnglish}
        aria-label={showEnglish ? "Hide English" : "Show English"}
        onClick={() => onChange(!showEnglish)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          showEnglish ? "bg-emerald-600" : "bg-zinc-300"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            showEnglish ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>
      <span className="tabular-nums text-zinc-500">{showEnglish ? "On" : "Off"}</span>
    </div>
  );
}
