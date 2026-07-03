"use client";

import { useEffect, useState } from "react";
import { BookCallWidget } from "@/components/booking/book-call-widget";
import { HubCard } from "@/components/ui/hub-primitives";

export function BookCallSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close booking"
        onClick={onClose}
      />
      <HubCard className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-zinc-900">Book a call with the team</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Choose a time for a free call. We can help you pick the right course or answer
              questions.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100"
          >
            Close
          </button>
        </div>
        <BookCallWidget className="rounded-xl border border-zinc-200 bg-white" />
      </HubCard>
    </div>
  );
}
