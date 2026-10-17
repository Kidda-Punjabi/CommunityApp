import type { CommunityBand } from "@/lib/community/constants";
import { bandForLevel, bandLabel } from "@/lib/community/levels";

export type OpenPod = {
  id: string;
  band: CommunityBand;
  minLevel: number;
  maxLevel: number;
  memberCount: number;
  maxSize: number;
  name: string;
};

export type PodChoice =
  | { kind: "join"; podId: string; minLevel: number; maxLevel: number }
  | { kind: "create"; band: CommunityBand; minLevel: number; maxLevel: number; name: string };

function distance(pod: OpenPod, level: number): number {
  if (level < pod.minLevel) return pod.minLevel - level;
  if (level > pod.maxLevel) return level - pod.maxLevel;
  return 0;
}

export function podName(weekdayLabel: string, band: CommunityBand, taken: string[]): string {
  const bandName = band === "beginner" ? "Beginners" : bandLabel(band);
  const base = `${weekdayLabel} ${bandName}`;
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

export function choosePod(pods: OpenPod[], level: number, weekdayLabel: string): PodChoice {
  const band = bandForLevel(level);
  const open = pods
    .filter((pod) => pod.band === band && pod.memberCount < pod.maxSize)
    .sort((a, b) => {
      const gap = distance(a, level) - distance(b, level);
      if (gap !== 0) return gap;
      const aRoom = a.memberCount < 5 ? 0 : 1;
      const bRoom = b.memberCount < 5 ? 0 : 1;
      if (aRoom !== bRoom) return aRoom - bRoom;
      return a.memberCount - b.memberCount;
    });

  const best = open[0];
  if (!best) {
    return {
      kind: "create",
      band,
      minLevel: level,
      maxLevel: level,
      name: podName(weekdayLabel, band, pods.map((pod) => pod.name)),
    };
  }

  return {
    kind: "join",
    podId: best.id,
    minLevel: Math.min(best.minLevel, level),
    maxLevel: Math.max(best.maxLevel, level),
  };
}
