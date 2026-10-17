"use client";

import { Celebration } from "@/components/community/celebration";
import { OnboardingButton, OnboardingFrame } from "@/components/community/onboarding-shell";
import { PlacementTest } from "@/components/community/placement-test";
import { SessionPicker } from "@/components/community/session-picker";
import { WelcomeIntro } from "@/components/community/welcome-intro";
import { levelFillVar, levelInkVar } from "@/lib/community/levels";

const SESSIONS = [
  {
    id: "uk-sun",
    weekdayLabel: "Sunday",
    startsAt: "2026-10-18T18:00:00.000Z",
    hostTimeZone: "Europe/London",
    hostCity: "London",
    running: true,
    cardName: "Plans & Dreams",
    firstStartsOn: "2026-01-05",
  },
  {
    id: "au-wed",
    weekdayLabel: "Wednesday",
    startsAt: "2026-10-21T09:00:00.000Z",
    hostTimeZone: "Australia/Sydney",
    hostCity: "Sydney",
    running: false,
    cardName: null,
    firstStartsOn: "2026-11-04",
  },
];

const STEPS = ["welcome", "session", "why", "levels", "placement", "done"] as const;

export type PreviewStepName = (typeof STEPS)[number];

export function PreviewStep({ step }: { step: PreviewStepName }) {
  if (step === "session") return <SessionPicker sessions={SESSIONS} />;
  if (step === "placement") return <PlacementTest />;
  if (step === "done") {
    return (
      <Celebration
        level={2}
        podName="Sunday pod"
        mates={[{ userId: "you", name: "You", level: 2 }]}
        when="Sun 18 Oct · Week 1"
        invited
        hideCalendar
      />
    );
  }
  if (step === "why") {
    return (
      <OnboardingFrame
        step="2 of 3"
        backHref="/onboarding-frame-preview?step=session"
        action={<OnboardingButton href="/onboarding-frame-preview?step=levels" tone="gold">See the levels</OnboardingButton>}
      >
        <div className="flex flex-col justify-start rounded-[24px] bg-[#5B21B6] p-5 text-white">
          <div className="grid grid-cols-5 gap-1">
            {Array.from({ length: 10 }, (_, level) => (
              <span key={level} className="flex h-8 items-center justify-center rounded-full text-xs font-bold" style={{ background: levelFillVar(level), color: levelInkVar(level) }}>{level}</span>
            ))}
          </div>
          <h1 className="mt-4 font-heading text-3xl font-extrabold">Let&apos;s find your level</h1>
          <p className="mt-4 rounded-[18px] bg-white/10 px-3 py-2 text-sm font-semibold">Your pod is people at a similar level</p>
        </div>
      </OnboardingFrame>
    );
  }
  if (step === "levels") {
    return (
      <OnboardingFrame
        step="2 of 3"
        backHref="/onboarding-frame-preview?step=why"
        action={<OnboardingButton href="/onboarding-frame-preview?step=placement">I&apos;m ready, start</OnboardingButton>}
      >
        <div>
          <h1 className="font-heading text-2xl font-extrabold">Ten levels, one path</h1>
          <p className="mt-3 rounded-[20px] bg-white p-3 text-sm font-semibold">Beginner · Levels 1 to 3</p>
        </div>
        <p className="rounded-[18px] bg-white px-3 py-2 text-center text-xs font-semibold text-[#4A3F66]">2 minutes · Listen and pick an answer · No Gurmukhi needed</p>
      </OnboardingFrame>
    );
  }
  return (
    <OnboardingFrame action={<OnboardingButton href="/onboarding-frame-preview?step=session">Get started</OnboardingButton>}>
      <WelcomeIntro />
    </OnboardingFrame>
  );
}
