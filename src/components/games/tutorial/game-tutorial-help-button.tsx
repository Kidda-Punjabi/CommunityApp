"use client";

import { CircleHelp } from "lucide-react";

type GameTutorialHelpButtonProps = {
  onClick: () => void;
  label?: string;
  className?: string;
};

export function GameTutorialHelpButton({
  onClick,
  label = "How to play",
  className = "",
}: GameTutorialHelpButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-600 shadow-sm transition-colors hover:border-violet-300 hover:text-violet-700 ${className}`}
      aria-label={label}
    >
      <CircleHelp className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
