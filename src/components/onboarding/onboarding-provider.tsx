"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { OnboardingOverlay } from "@/components/onboarding/onboarding-overlay";

type OnboardingContextValue = {
  openTestOnboarding: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}

type OnboardingProviderProps = {
  showOnFirstVisit: boolean;
  children: React.ReactNode;
};

export function OnboardingProvider({ showOnFirstVisit, children }: OnboardingProviderProps) {
  const [open, setOpen] = useState(showOnFirstVisit);
  const [testMode, setTestMode] = useState(false);

  const openTestOnboarding = useCallback(() => {
    setTestMode(true);
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ openTestOnboarding }), [openTestOnboarding]);

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      {open && (
        <OnboardingOverlay
          isTestMode={testMode}
          onClose={() => {
            setOpen(false);
            setTestMode(false);
          }}
        />
      )}
    </OnboardingContext.Provider>
  );
}
