import Link from "next/link";
import { SummaryRow } from "@/components/ui/hub-primitives";
import { xpEarnedForDisplay, XpProgressBar } from "@/components/profile/xp-progress-bar";
import type { UserProgression } from "@/lib/progression/load-user-progression";

type ProgressSummaryRowProps = {
  progression: UserProgression;
};

export function ProgressSummaryRow({ progression }: ProgressSummaryRowProps) {
  const { tier, placementCompleted, learnerLevel, xpProgress } = progression;

  if (!placementCompleted || learnerLevel == null || tier == null) {
    return (
      <SummaryRow href="/dashboard/profile/progress" title="Progress">
        <p className="text-sm text-zinc-500">Complete placement to see your level</p>
      </SummaryRow>
    );
  }

  const earned =
    xpProgress != null ? xpEarnedForDisplay(xpProgress.earnedAtLevel, xpProgress.required) : 0;
  const percent =
    xpProgress && xpProgress.required > 0
      ? Math.min(100, Math.round((earned / xpProgress.required) * 100))
      : 0;

  return (
    <SummaryRow href="/dashboard/profile/progress" title="Progress">
      <p className="text-sm text-zinc-500">
        Level {tier.tier} · {tier.name}
      </p>
      {xpProgress ? (
        <div className="mt-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-violet-600"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      ) : null}
    </SummaryRow>
  );
}
