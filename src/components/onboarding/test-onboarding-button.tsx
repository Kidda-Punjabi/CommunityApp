"use client";

import { useState, useTransition } from "react";
import { useOnboarding } from "@/components/first-run/first-run-provider";
import { useAppTours } from "@/components/tours/tour-provider";
import { resetTourFlags } from "@/app/dashboard/tours/actions";

const buttonClass =
  "inline-block rounded-lg border border-violet-300 bg-white px-4 py-2.5 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-50 disabled:opacity-60";

export function TestOnboardingButton() {
  const { openTestIntroPitch, openTestOnboarding } = useOnboarding();
  const { previewAppTour, previewCourseResourceTour } = useAppTours();
  const [pending, startTransition] = useTransition();
  const [resetArmed, setResetArmed] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  function handlePreviewCourse() {
    startTransition(async () => {
      const message = await previewCourseResourceTour();
      if (message) setStatus(message);
      else setStatus(null);
    });
  }

  function handleReset() {
    if (!resetArmed) {
      setResetArmed(true);
      setStatus("Tap again to confirm reset of tour flags.");
      return;
    }
    startTransition(async () => {
      const result = await resetTourFlags();
      setResetArmed(false);
      if (result.error) {
        setStatus(result.error);
        return;
      }
      setStatus("Tour flags reset. Reload to test real triggers.");
    });
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={openTestIntroPitch} className={buttonClass}>
          Test intro pitch
        </button>
        <button type="button" onClick={openTestOnboarding} className={buttonClass}>
          Test app onboarding
        </button>
        <button type="button" onClick={previewAppTour} className={buttonClass} disabled={pending}>
          Preview App Tour
        </button>
        <button
          type="button"
          onClick={handlePreviewCourse}
          className={buttonClass}
          disabled={pending}
        >
          Preview Course Resource Tour
        </button>
        <button
          type="button"
          onClick={handleReset}
          className={buttonClass}
          disabled={pending}
        >
          {resetArmed ? "Confirm reset tour flags" : "Reset tour flags"}
        </button>
      </div>
      {status ? <p className="text-xs text-zinc-500">{status}</p> : null}
    </div>
  );
}
