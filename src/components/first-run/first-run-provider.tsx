"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { IntroPitchOverlay } from "@/components/intro-pitch/intro-pitch-overlay";
import { OnboardingOverlay } from "@/components/onboarding/onboarding-overlay";

type FirstRunPhase = "intro" | "app-onboarding" | "none";

type FirstRunContextValue = {
  openTestIntroPitch: () => void;
  openTestOnboarding: () => void;
};

const FirstRunContext = createContext<FirstRunContextValue | null>(null);

export function useOnboarding() {
  const ctx = useContext(FirstRunContext);
  if (!ctx) throw new Error("useOnboarding must be used within FirstRunProvider");
  return ctx;
}

type FirstRunProviderProps = {
  hasSeenIntroPitch: boolean;
  hasSeenOnboarding: boolean;
  children: React.ReactNode;
};

function resolveInitialPhase(
  hasSeenIntroPitch: boolean,
  hasSeenOnboarding: boolean
): FirstRunPhase {
  if (!hasSeenIntroPitch) return "intro";
  if (!hasSeenOnboarding) return "app-onboarding";
  return "none";
}

export function FirstRunProvider({
  hasSeenIntroPitch,
  hasSeenOnboarding,
  children,
}: FirstRunProviderProps) {
  const [phase, setPhase] = useState<FirstRunPhase>(() =>
    resolveInitialPhase(hasSeenIntroPitch, hasSeenOnboarding)
  );
  const [testIntro, setTestIntro] = useState(false);
  const [testOnboarding, setTestOnboarding] = useState(false);

  const openTestIntroPitch = useCallback(() => {
    setTestIntro(true);
    setTestOnboarding(false);
    setPhase("intro");
  }, []);

  const openTestOnboarding = useCallback(() => {
    setTestOnboarding(true);
    setTestIntro(false);
    setPhase("app-onboarding");
  }, []);

  const value = useMemo(
    () => ({ openTestIntroPitch, openTestOnboarding }),
    [openTestIntroPitch, openTestOnboarding]
  );

  function handleIntroClose() {
    setTestIntro(false);
    if (testIntro) {
      setPhase("none");
      return;
    }
    if (!hasSeenOnboarding) {
      setPhase("app-onboarding");
      return;
    }
    setPhase("none");
  }

  function handleOnboardingClose() {
    setTestOnboarding(false);
    setPhase("none");
  }

  const showIntro = phase === "intro" || testIntro;
  const showAppOnboarding = (phase === "app-onboarding" || testOnboarding) && !showIntro;

  return (
    <FirstRunContext.Provider value={value}>
      {children}
      {showIntro ? (
        <IntroPitchOverlay isTestMode={testIntro} onClose={handleIntroClose} />
      ) : null}
      {showAppOnboarding ? (
        <OnboardingOverlay isTestMode={testOnboarding} onClose={handleOnboardingClose} />
      ) : null}
    </FirstRunContext.Provider>
  );
}
