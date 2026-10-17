"use client";

import { OnboardingButton, OnboardingFrame } from "@/components/community/onboarding-shell";
import { LEVEL_COPY } from "@/lib/community/placement-copy";
import { levelFillVar, levelInkVar, levelLabel } from "@/lib/community/levels";
import { hapticSuccess } from "@/lib/native/haptics";
import { useEffect } from "react";

export function Celebration({
  level,
  podName,
  mates,
  when,
  invited,
  hideCalendar = false,
}: {
  level: number;
  podName: string;
  mates: { userId: string; name: string; level: number | null }[];
  when: string;
  invited: boolean;
  hideCalendar?: boolean;
}) {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) {
      void import("canvas-confetti").then(({ default: confetti }) => {
        void confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.3 },
          colors: ["#5B21B6", "#7C3AED", "#FDE68A", "#2CCB9E", "#F5B301"],
        });
      });
    }
    void hapticSuccess();
  }, []);

  const copy = LEVEL_COPY[level];
  return (
    <OnboardingFrame action={<OnboardingButton href="/dashboard/community">Go to my Community</OnboardingButton>}>
      <div className="flex flex-1 flex-col justify-center rounded-[24px] bg-[#5B21B6] p-5 text-white">
        <p className="font-heading text-3xl font-extrabold">Shabash!</p>
        <h1 className="font-heading text-4xl font-extrabold">You&apos;re in</h1>
        <p className="mt-3 inline-flex w-fit rounded-full px-3 py-1 text-sm font-bold" style={{ background: levelFillVar(level), color: levelInkVar(level) }}>
          {levelLabel(level)}
        </p>
        <p className="mt-3 text-sm text-violet-100">{copy.now} {copy.next}</p>
        <div className="mt-4 rounded-[20px] bg-white p-4 text-[#1F1640]">
          <p className="font-heading text-lg font-extrabold">{podName}</p>
          <div className="mt-2 flex gap-2">
            {mates.slice(0, 6).map((mate) => (
              <span
                key={mate.userId}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F7F5FC] text-sm font-bold"
                style={mate.level == null ? undefined : { boxShadow: `0 0 0 3px ${levelFillVar(mate.level)}` }}
              >
                {mate.name.slice(0, 1)}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-[#6B5F8A]">{mates.length} {mates.length === 1 ? "member" : "members"}</p>
          <p className="mt-2 text-sm font-semibold">{when}</p>
          {hideCalendar ? null : <p className="mt-1 text-sm text-[#4A3F66]">{invited ? "Added to your calendar" : "We'll send your calendar invite shortly"}</p>}
        </div>
      </div>
    </OnboardingFrame>
  );
}
