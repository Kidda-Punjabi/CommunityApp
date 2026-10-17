import { bandForLevel } from "@/lib/community/levels";

export type LevelHistoryRow = {
  fromLevel: number | null;
  toLevel: number;
  source: "placement" | "retake" | "admin" | "migration";
  createdAt: string;
};

const DEFAULT_TARGETS: Record<string, number> = {
  "0": 100,
  "1": 150,
  "2": 150,
  "3": 200,
  "4": 200,
  "5": 250,
  "6": 300,
  "7": 300,
  "8": 350,
};

export function xpTargetForLevel(level: number, table: Record<string, number> | null): number | null {
  if (level >= 9) return null;
  const value = table?.[String(level)] ?? DEFAULT_TARGETS[String(level)];
  return typeof value === "number" && value > 0 ? value : null;
}

export function xpRoad(earned: number, target: number | null) {
  if (target == null) return { earned: Math.max(0, earned), target: 0, percent: 100, unlocked: false };
  const safeEarned = Math.max(0, earned);
  const percent = Math.min(100, Math.round((safeEarned / target) * 100));
  return { earned: Math.min(safeEarned, target), percent, target, unlocked: safeEarned >= target };
}

export function levelEstablishedAt(history: LevelHistoryRow[], current: number): string | null {
  const row = [...history]
    .reverse()
    .find((entry) => entry.toLevel === current && (entry.fromLevel == null || entry.fromLevel < entry.toLevel));
  return row?.createdAt ?? null;
}

export function failedRetakeAt(history: LevelHistoryRow[]): string | null {
  const latest = [...history].reverse().find((entry) => entry.source === "retake");
  if (!latest) return null;
  if (latest.fromLevel != null && latest.toLevel > latest.fromLevel) return null;
  return latest.createdAt;
}

export function cooldownUntil(failedAt: string | null, cooldownDays: number, now = new Date()): Date | null {
  if (!failedAt) return null;
  const until = new Date(Date.parse(failedAt) + cooldownDays * 86_400_000);
  return until.getTime() > now.getTime() ? until : null;
}

export function retakeMovesUp(current: number, scored: number): boolean {
  return scored > current;
}

export function bandChanged(from: number, to: number): boolean {
  return bandForLevel(from) !== bandForLevel(to);
}

export const OLD_TIER_TO_KIDDA: Record<number, number> = {
  1: 0,
  2: 1,
  3: 1,
  4: 2,
  5: 3,
  6: 4,
  7: 6,
  8: 8,
};
