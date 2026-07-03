"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LevelStepper } from "@/components/profile/level-stepper";
import { XpProgressBar } from "@/components/profile/xp-progress-bar";
import {
  EyebrowLabel,
  HubCard,
  HubGhostLink,
} from "@/components/ui/hub-primitives";
import type { UserProgression } from "@/lib/progression/load-user-progression";
import { XP_EARNED_EVENT } from "@/lib/points/notify-points-earned";
import { ui } from "@/lib/ui/styles";

type ProgressDetailProps = {
  progression: UserProgression;
};

function GoalLine({ progression }: { progression: UserProgression }) {
  if (!progression.goalMotivationLabel && !progression.targetTierMeta) return null;

  return (
    <p className="mt-3 text-sm text-zinc-600">
      <span className="font-medium text-zinc-900">Your goal:</span>{" "}
      {progression.goalMotivationLabel ?? "Learn Punjabi"}
      {progression.targetTierMeta ? ` — aiming for ${progression.targetTierMeta.name}` : ""}
    </p>
  );
}

export function ProgressDetail({ progression }: ProgressDetailProps) {
  const router = useRouter();
  const { tier, whatsNext, placementCompleted, learnerLevel } = progression;

  useEffect(() => {
    function handleXpEarned() {
      router.refresh();
    }

    window.addEventListener(XP_EARNED_EVENT, handleXpEarned);
    return () => window.removeEventListener(XP_EARNED_EVENT, handleXpEarned);
  }, [router]);

  if (!placementCompleted || learnerLevel == null || tier == null) {
    return (
      <div className={ui.page}>
        <Link href="/dashboard/profile" className="text-sm font-medium text-violet-600 hover:text-violet-500">
          ← Profile
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-zinc-900">Progress</h1>
        <HubCard className="mt-6">
          <EyebrowLabel>Your level</EyebrowLabel>
          <h2 className="mt-1 text-lg font-medium text-zinc-900">Not placed yet</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Complete the placement assessment to see your level and unlock XP progress toward
            level-up tests.
          </p>
          <Link
            href="/dashboard/placement"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500"
          >
            Complete placement
          </Link>
        </HubCard>
      </div>
    );
  }

  return (
    <div className={`${ui.page} ${ui.stackLoose}`}>
      <div>
        <Link href="/dashboard/profile" className="text-sm font-medium text-violet-600 hover:text-violet-500">
          ← Profile
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-zinc-900">Progress</h1>
      </div>

      <HubCard>
        <EyebrowLabel>Your level</EyebrowLabel>
        <h2 className="mt-1 text-lg font-medium text-zinc-900">
          Level {tier.tier}: {tier.name}
        </h2>
        <p className="mt-1 text-sm text-zinc-600">{tier.description}</p>
        <GoalLine progression={progression} />
        <XpProgressBar progression={progression} />
      </HubCard>

      <HubCard>
        <p className="text-sm font-medium text-zinc-900">{whatsNext.headline}</p>
        <p className="mt-1 text-sm text-zinc-600">{whatsNext.detail}</p>
        {whatsNext.actionHref && whatsNext.actionLabel ? (
          <Link
            href={whatsNext.actionHref}
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500"
          >
            {whatsNext.actionLabel}
          </Link>
        ) : null}
      </HubCard>

      <HubCard>
        <EyebrowLabel>Level roadmap</EyebrowLabel>
        <div className="mt-3">
          <LevelStepper currentLevel={learnerLevel} />
        </div>
        <HubGhostLink href="/dashboard/placement" className="mt-4 inline-block">
          View placement details
        </HubGhostLink>
      </HubCard>
    </div>
  );
}
