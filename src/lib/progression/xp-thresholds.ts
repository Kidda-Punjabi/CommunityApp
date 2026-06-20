/** XP you must earn at your current level to unlock the level-up test. */
export const XP_REQUIRED_AT_LEVEL: Record<number, number> = {
  1: 100,
  2: 100,
  3: 150,
  4: 150,
  5: 200,
  6: 250,
  7: 250,
};

export function xpRequiredForTest(currentLevel: number): number | null {
  if (currentLevel >= 8) return null;
  return XP_REQUIRED_AT_LEVEL[currentLevel] ?? null;
}

/** XP earned since the current level began (lifetime total minus level-up snapshot). */
export function xpEarnedAtLevel(totalXp: number, xpAtLevelStart: number): number {
  return Math.max(0, totalXp - xpAtLevelStart);
}

export function xpProgressToNextTest(
  currentLevel: number,
  totalXp: number,
  xpAtLevelStart: number
): {
  earnedAtLevel: number;
  required: number;
  percent: number;
  totalXp: number;
} | null {
  const required = xpRequiredForTest(currentLevel);
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
  xpAtLevelStart: number
): boolean {
  const required = xpRequiredForTest(currentLevel);
  if (required == null) return false;
  return xpEarnedAtLevel(totalXp, xpAtLevelStart) >= required;
}

export function xpRemainingForTest(
  currentLevel: number,
  totalXp: number,
  xpAtLevelStart: number
): number {
  const required = xpRequiredForTest(currentLevel);
  if (required == null) return 0;
  return Math.max(0, required - xpEarnedAtLevel(totalXp, xpAtLevelStart));
}
