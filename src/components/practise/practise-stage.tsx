"use client";

import type { ReactNode } from "react";
import { BodyPortal } from "@/components/ui/body-portal";

/**
 * Full-screen Practise steps sit above the bottom nav. The box is a flex
 * column so a footer button stays inside it, including when the native
 * safe-area rules shorten `inset-0`.
 */
export function PractiseStage({
  children,
  className = "bg-white",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <BodyPortal>
      <div className={`kidda-edge fixed inset-0 z-[60] flex flex-col overflow-hidden ${className}`}>
        {children}
      </div>
    </BodyPortal>
  );
}

export function PractiseClose({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="absolute right-2 top-[max(0.25rem,var(--kidda-inset-top))] z-10 flex h-11 w-11 items-center justify-center text-zinc-700"
    >
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  );
}
