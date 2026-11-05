"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/ui/styles";

/**
 * A lesson row that opens its content in a pop-up from the bottom of the screen.
 * Links back to `#lesson-<id>` (homework, feedback, notifications) reopen it.
 */
export function LessonSheet({
  lessonId,
  weekNumber,
  title,
  defaultOpen = false,
  triggerClassName,
  trigger,
  children,
}: {
  lessonId: string;
  weekNumber: number;
  title: string;
  defaultOpen?: boolean;
  triggerClassName?: string;
  trigger: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (defaultOpen || window.location.hash === `#lesson-${lessonId}`) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(true);
    }
  }, [defaultOpen, lessonId]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function close() {
    setOpen(false);
    if (window.location.hash === `#lesson-${lessonId}`) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={cn("block w-full text-left", triggerClassName)}
      >
        {trigger}
      </button>
      {open
        ? createPortal(
            <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#1F1640]/55 sm:items-center sm:p-4" onClick={close}>
              <div
                role="dialog"
                aria-modal="true"
                aria-label={`Week ${weekNumber}, ${title}`}
                onClick={(event) => event.stopPropagation()}
                className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-white px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-xl sm:rounded-[28px] sm:pt-5"
              >
                <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-zinc-200 sm:hidden" aria-hidden="true" />
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-extrabold tracking-wide text-white">WEEK {weekNumber}</span>
                    <h2 className="mt-2.5 font-heading text-[26px] font-extrabold leading-tight tracking-tight text-zinc-900">{title}</h2>
                  </div>
                  <button ref={closeRef} type="button" onClick={close} aria-label="Close" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-900">
                    <X className="h-5 w-5" aria-hidden />
                  </button>
                </div>
                {children}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
