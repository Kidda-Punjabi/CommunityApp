import { xpTargetForLevel } from "@/lib/community/level-progress";

/** XP table from community_level_settings.xp_to_unlock (level -> XP to unlock the next level). */
export type XpTargetTable = Record<string, number> | null | undefined;

/**
 * XP you must earn at your current level to unlock the level-up check.
 * One table for the whole app: community_level_settings.xp_to_unlock, with the same
 * defaults the Community level screen uses when it can't be read.
 */
export function xpRequiredForTest(currentLevel: number, table?: XpTargetTable): number | null {
  return xpTargetForLevel(currentLevel, table ?? null);
}

/** XP earned since the current level began (lifetime total minus level-up snapshot). */
export function xpEarnedAtLevel(totalXp: number, xpAtLevelStart: number): number {
  return Math.max(0, totalXp - xpAtLevelStart);
}

export function xpProgressToNextTest(
  currentLevel: number,
  totalXp: number,
  xpAtLevelStart: number,
  table?: XpTargetTable
): {
  earnedAtLevel: number;
  required: number;
  percent: number;
  totalXp: number;
} | null {
  const required = xpRequiredForTest(currentLevel, table);
  if (required == null) return null;

  const earnedAtLevel = xpEarnedAtLevel(totalXp, xpAtLevelStart);
  const percent =
    required > 0 ? Math.min(100, Math.round((earnedAtLevel / required) * 100)) : 100;

  return {
    earnedAtLevel,
    required,
    percent: earnedAtLevel >= required ? 100 : percent,
    totalXp,
  };
}

export function isTestUnlocked(
  currentLevel: number,
  totalXp: number,
  xpAtLevelStart: number,
  table?: XpTargetTable
): boolean {
  const required = xpRequiredForTest(currentLevel, table);
  if (required == null) return false;
  return xpEarnedAtLevel(totalXp, xpAtLevelStart) >= required;
}

export function xpRemainingForTest(
  currentLevel: number,
  totalXp: number,
  xpAtLevelStart: number,
  table?: XpTargetTable
): number {
  const required = xpRequiredForTest(currentLevel, table);
  if (required == null) return 0;
  return Math.max(0, required - xpEarnedAtLevel(totalXp, xpAtLevelStart));
}
