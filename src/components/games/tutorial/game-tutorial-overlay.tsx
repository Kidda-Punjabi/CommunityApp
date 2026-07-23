"use client";

import { useEffect, useId, useState } from "react";
import type { GameTutorialContent } from "@/lib/games/tutorials/types";
import { ui } from "@/lib/ui/styles";

type GameTutorialOverlayProps = {
  content: GameTutorialContent;
  open: boolean;
  /** When true, "Don't show again" starts checked (first-play). Help reopen starts unchecked. */
  preferDontShowAgain?: boolean;
  onClose: (options: { dontShowAgain: boolean }) => void;
};

export function GameTutorialOverlay({
  content,
  open,
  preferDontShowAgain = true,
  onClose,
}: GameTutorialOverlayProps) {
  const titleId = useId();
  const [dontShowAgain, setDontShowAgain] = useState(preferDontShowAgain);

  useEffect(() => {
    if (open) {
      setDontShowAgain(preferDontShowAgain);
    }
  }, [open, preferDontShowAgain, content.id]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-zinc-900/60 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Dismiss tutorial"
        onClick={() => onClose({ dontShowAgain: false })}
      />
      <div className="relative z-10 flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            How to play
          </p>
          <button
            type="button"
            onClick={() => onClose({ dontShowAgain: false })}
            className="text-sm font-medium text-zinc-500 hover:text-zinc-800"
          >
            Dismiss
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <h2 id={titleId} className="text-xl font-bold text-zinc-900">
            {content.title}
          </h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-zinc-600">
            {content.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>

        <div className="space-y-3 border-t border-zinc-100 px-5 py-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(event) => setDontShowAgain(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
            />
            <span className="text-sm text-zinc-600">
              Don&apos;t show again automatically
              <span className="mt-0.5 block text-xs text-zinc-400">
                You can still open this anytime from the help button.
              </span>
            </span>
          </label>
          <button
            type="button"
            onClick={() => onClose({ dontShowAgain })}
            className={ui.btnPrimaryBlock}
          >
            {content.ctaLabel ?? "Got it"}
          </button>
        </div>
      </div>
    </div>
  );
}
