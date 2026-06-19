"use client";

import { useOnboarding } from "@/components/onboarding/onboarding-provider";

export function TestOnboardingButton() {
  const { openTestOnboarding } = useOnboarding();

  return (
    <button
      type="button"
      onClick={openTestOnboarding}
      className="mt-3 inline-block rounded-lg border border-violet-300 bg-white px-4 py-2.5 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-50"
    >
      Test onboarding
    </button>
  );
}
