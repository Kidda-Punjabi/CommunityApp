import type { UserProgression } from "@/lib/progression/load-user-progression";

type XpProgressBarProps = {
  progression: UserProgression;
  compact?: boolean;
};

/** XP earned within the current level band (capped for display when lifetime XP exceeds threshold). */
export function xpEarnedForDisplay(earnedAtLevel: number, required: number): number {
  return Math.min(Math.max(0, earnedAtLevel), required);
}

export function XpProgressBar({ progression, compact = false }: XpProgressBarProps) {
  const { nextTier, xpProgress, totalXp, learnerLevel } = progression;

  if (!nextTier || !xpProgress || learnerLevel == null || learnerLevel >= 8) {
    return (
      <p className={`text-sm text-zinc-500 ${compact ? "mt-2" : "mt-3"}`}>
        {totalXp} XP lifetime
        {learnerLevel != null && learnerLevel >= 8 ? " · Max level reached" : ""}
      </p>
    );
  }

  const earned = xpEarnedForDisplay(xpProgress.earnedAtLevel, xpProgress.required);
  const percent =
    xpProgress.required > 0
      ? Math.min(100, Math.round((earned / xpProgress.required) * 100))
      : 100;

  return (
    <div className={compact ? "mt-2 space-y-1.5" : "mt-3 space-y-1.5"}>
      <div className="flex justify-between text-xs text-zinc-500">
        <span>Progress to Level {nextTier.tier} test</span>
        <span>
          {earned} / {xpProgress.required} XP toward test
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-violet-600 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs text-zinc-500">{totalXp} XP lifetime</p>
    </div>
  );
}
