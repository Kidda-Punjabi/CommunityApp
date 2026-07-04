"use client";

import { useOnboarding } from "@/components/first-run/first-run-provider";

export function TestOnboardingButton() {
  const { openTestIntroPitch, openTestOnboarding } = useOnboarding();

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={openTestIntroPitch}
        className="inline-block rounded-lg border border-violet-300 bg-white px-4 py-2.5 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-50"
      >
        Test intro pitch
      </button>
      <button
        type="button"
        onClick={openTestOnboarding}
        className="inline-block rounded-lg border border-violet-300 bg-white px-4 py-2.5 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-50"
      >
        Test app onboarding
      </button>
    </div>
  );
}
