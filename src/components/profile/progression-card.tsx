"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { UserProgression } from "@/lib/progression/load-user-progression";
import { XP_EARNED_EVENT } from "@/lib/points/notify-points-earned";
import { ui } from "@/lib/ui/styles";
import { XpProgressBar } from "@/components/profile/xp-progress-bar";
import { EyebrowLabel } from "@/components/ui/hub-primitives";

type ProgressionCardProps = {
  progression: UserProgression;
  /** condensed = dashboard summary; full = legacy profile (prefer /profile/progress) */
  variant?: "condensed" | "full";
};

function GoalLine({ progression }: { progression: UserProgression }) {
  if (!progression.goalMotivationLabel && !progression.targetTierMeta) return null;

  return (
    <p className="mt-3 rounded-2xl bg-violet-50 px-4 py-3 text-sm text-violet-900">
      <span className="font-medium">Your goal:</span>{" "}
      {progression.goalMotivationLabel ?? "Learn Punjabi"}
      {progression.targetTierMeta ? ` — aiming for ${progression.targetTierMeta.name}` : ""}
    </p>
  );
}

export function ProgressionCard({ progression, variant = "full" }: ProgressionCardProps) {
  const router = useRouter();
  const { tier, placementCompleted, learnerLevel } = progression;

  useEffect(() => {
    function handleXpEarned() {
      router.refresh();
    }

    window.addEventListener(XP_EARNED_EVENT, handleXpEarned);
    return () => window.removeEventListener(XP_EARNED_EVENT, handleXpEarned);
  }, [router]);

  if (!placementCompleted || learnerLevel == null || tier == null) {
    return (
      <div className={ui.card}>
        <EyebrowLabel>Your level</EyebrowLabel>
        <h2 className="mt-2 font-heading text-xl font-bold text-zinc-900">Not placed yet</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          Complete the placement assessment to see your level and unlock XP progress toward
          level-up tests.
        </p>
        <Link
          href="/dashboard/placement"
          className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
        >
          Complete placement
        </Link>
      </div>
    );
  }

  if (variant === "condensed") {
    return (
      <div className={ui.card}>
        <EyebrowLabel>Your level</EyebrowLabel>
        <p className="mt-2 font-heading text-lg font-bold text-zinc-900">
          Level {tier.tier}: {tier.name}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-zinc-600">{tier.description}</p>
        <GoalLine progression={progression} />
        <XpProgressBar progression={progression} compact />
      </div>
    );
  }

  return (
    <div className={ui.card}>
      <EyebrowLabel>Your level</EyebrowLabel>
      <div className="mt-2">
        <p className="font-heading text-xl font-bold text-zinc-900">
          Level {tier.tier}: {tier.name}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-zinc-600">{tier.description}</p>
      </div>
      <GoalLine progression={progression} />
      <XpProgressBar progression={progression} />
      <Link
        href="/dashboard/profile/progress"
        className="mt-4 inline-block text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        View full progress
      </Link>
    </div>
  );
}
