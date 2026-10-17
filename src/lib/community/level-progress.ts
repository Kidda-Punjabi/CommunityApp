import { bandForLevel } from "@/lib/community/levels";

export type LevelSettings = {
  sessionsToUnlock: number;
  cooldownDays: number;
};

export type LevelHistoryRow = {
  fromLevel: number | null;
  toLevel: number;
  source: "placement" | "retake" | "admin";
  createdAt: string;
};

export function roadProgress(mainCheckinsSinceLevel: number, sessionsToUnlock: number) {
  const goal = Math.max(1, sessionsToUnlock);
  const done = Math.max(0, mainCheckinsSinceLevel);
  const percent = Math.min(100, Math.round((done / goal) * 100));
  return { done: Math.min(done, goal), percent, unlocked: done >= goal };
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
