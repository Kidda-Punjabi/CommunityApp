"use client";

import { BackLink } from "@/components/navigation/back-link";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ClipboardCheck } from "lucide-react";
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

function LevelSummaryHeader({ tier }: { tier: NonNullable<UserProgression["tier"]> }) {
  return (
    <div className="flex items-center gap-4">
      <div
        className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border-2 border-violet-600 text-xl font-bold text-violet-600"
        aria-hidden="true"
      >
        {tier.tier}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-zinc-500">Level {tier.tier}</p>
        <h2 className="text-lg font-bold leading-tight text-zinc-900">{tier.name}</h2>
      </div>
    </div>
  );
}

function TestAvailableSection({
  whatsNext,
}: {
  whatsNext: UserProgression["whatsNext"];
}) {
  return (
    <div className="pt-5">
      <div className="flex items-start gap-2">
        <ClipboardCheck
          className="mt-0.5 h-4 w-4 shrink-0 text-violet-600"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-900">{whatsNext.headline}</p>
          <p className="mt-1 text-sm text-zinc-600">{whatsNext.detail}</p>
          {whatsNext.actionHref && whatsNext.actionLabel ? (
            <BackLink
              fallbackHref={whatsNext.actionHref}
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500"
            >
              {whatsNext.actionLabel}
            </BackLink>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ProgressDetail({ progression }: ProgressDetailProps) {
  const router = useRouter();
  const { tier, whatsNext, placementCompleted, learnerLevel, testUnlocked } = progression;
  const showTestSection =
    testUnlocked && learnerLevel != null && learnerLevel < 8;

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
        <BackLink fallbackHref="/dashboard/profile" className="text-sm font-medium text-violet-600 hover:text-violet-500">← Profile</BackLink>
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
        <BackLink fallbackHref="/dashboard/profile" className="text-sm font-medium text-violet-600 hover:text-violet-500">← Profile</BackLink>
        <h1 className="mt-4 text-2xl font-bold text-zinc-900">Progress</h1>
      </div>

      <HubCard>
        <LevelSummaryHeader tier={tier} />
        <p className="mt-3 text-sm text-zinc-600">{tier.description}</p>
        <GoalLine progression={progression} />
        <XpProgressBar progression={progression} variant="detail" />
        {showTestSection ? (
          <>
            <div className="mt-5 border-t border-zinc-100" role="separator" />
            <TestAvailableSection whatsNext={whatsNext} />
          </>
        ) : null}
      </HubCard>

      <HubCard>
        <EyebrowLabel>Level roadmap</EyebrowLabel>
        <div className="mt-3">
          <LevelStepper currentLevel={learnerLevel} targetTier={progression.targetTier} />
        </div>
        <HubGhostLink href="/dashboard/placement" className="mt-4 inline-block">
          View placement details
        </HubGhostLink>
      </HubCard>
    </div>
  );
}
