"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { UserProgression } from "@/lib/progression/load-user-progression";
import { LEVEL_TEST_PASS_PCT } from "@/lib/progression/level-tests";
import { XP_EARNED_EVENT } from "@/lib/points/notify-points-earned";
import { PROGRESSION_TIERS } from "@/lib/progression/tiers";
import { ui } from "@/lib/ui/styles";

type ProgressionCardProps = {
  progression: UserProgression;
};

export function ProgressionCard({ progression }: ProgressionCardProps) {
  const router = useRouter();
  const {
    tier,
    nextTier,
    totalXp,
    xpProgress,
    whatsNext,
    latestTestAttempt,
    placementCompleted,
    learnerLevel,
    targetTier,
  } = progression;

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
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Your level</p>
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

  const xpLabel = xpProgress
    ? `${xpProgress.earnedAtLevel} / ${xpProgress.required} XP toward test`
    : `${totalXp} XP total`;

  return (
    <div className={ui.card}>
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Your level</p>

      <div className="mt-2 flex items-start justify-between gap-3">
        <div>
          <p className="font-heading text-xl font-bold text-zinc-900">
            Level {tier.tier}: {tier.name}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-600">{tier.description}</p>
        </div>
        <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
          {totalXp} XP total
        </span>
      </div>

      {(progression.goalMotivationLabel || progression.targetTierMeta) && (
        <p className="mt-4 rounded-2xl bg-violet-50 px-4 py-3 text-sm text-violet-900">
          <span className="font-medium">Your goal:</span>{" "}
          {progression.goalMotivationLabel ?? "Learn Punjabi"}
          {progression.targetTierMeta
            ? ` — aiming for ${progression.targetTierMeta.name}`
            : ""}
        </p>
      )}

      {nextTier && xpProgress && (
        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between text-xs text-zinc-500">
            <span>Progress to Level {nextTier.tier} test</span>
            <span>{xpLabel}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-violet-600 transition-all"
              style={{ width: `${xpProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
        <p className="text-sm font-semibold text-zinc-900">{whatsNext.headline}</p>
        <p className="mt-1 text-sm text-zinc-600">{whatsNext.detail}</p>
        {latestTestAttempt && !latestTestAttempt.passed && learnerLevel != null && learnerLevel < 8 && (
          <p className="mt-2 text-xs text-amber-700">
            Last attempt: {latestTestAttempt.scorePct}% — need {LEVEL_TEST_PASS_PCT}%+ to pass
          </p>
        )}
        {whatsNext.actionHref && whatsNext.actionLabel && (
          <Link
            href={whatsNext.actionHref}
            className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
          >
            {whatsNext.actionLabel}
          </Link>
        )}
      </div>

      <ul className="mt-4 space-y-1">
        {PROGRESSION_TIERS.map((entry) => {
          const isCurrent = entry.tier === tier.tier;
          const isTarget = entry.tier === targetTier;
          return (
            <li
              key={entry.tier}
              className={`rounded-full px-3 py-1.5 text-xs ${
                isCurrent
                  ? "bg-violet-600 font-semibold text-white"
                  : isTarget
                    ? "border border-violet-300 bg-violet-50 font-medium text-violet-800"
                    : entry.tier < tier.tier
                      ? "text-zinc-400"
                      : "text-zinc-500"
              }`}
            >
              {entry.tier}. {entry.name}
              {isTarget && !isCurrent ? " (goal)" : ""}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
