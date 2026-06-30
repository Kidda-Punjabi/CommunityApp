"use client";

import type { ReactNode } from "react";

type AdminStatusPillProps = {
  children: ReactNode;
  tone?: "amber" | "violet" | "green" | "zinc";
};

const tones = {
  amber: "bg-amber-50 text-amber-800",
  violet: "bg-violet-50 text-violet-800",
  green: "bg-green-50 text-green-800",
  zinc: "bg-zinc-100 text-zinc-600",
};

export function AdminStatusPill({ children, tone = "zinc" }: AdminStatusPillProps) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

type AdminFilterPillProps = {
  label: string;
  active?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
};

export function AdminFilterPill({ label, active, onClick, onRemove }: AdminFilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "border-violet-300 bg-violet-50 text-violet-800"
          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
      }`}
    >
      {label}
      {onRemove && (
        <span
          role="button"
          tabIndex={0}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              onRemove();
            }
          }}
          className="text-zinc-400 hover:text-zinc-600"
          aria-label={`Remove ${label} filter`}
        >
          ×
        </span>
      )}
    </button>
  );
}
