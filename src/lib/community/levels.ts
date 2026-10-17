import type { CommunityBand } from "@/lib/community/constants";

export type KiddaLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export function bandForLevel(level: number): CommunityBand {
  if (level <= 0) return "sounds";
  if (level <= 3) return "beginner";
  if (level <= 6) return "intermediate";
  return "advanced";
}

export function bandLabel(band: CommunityBand): string {
  if (band === "sounds") return "Sounds";
  if (band === "beginner") return "Beginner";
  if (band === "intermediate") return "Intermediate";
  return "Advanced";
}

export function levelLabel(level: number): string {
  return `Level ${level} · ${bandLabel(bandForLevel(level))}`;
}

export function levelFillVar(level: number): string {
  const clamped = Math.min(9, Math.max(0, level));
  return `var(--kidda-level-${clamped}-fill)`;
}

export function levelInkVar(level: number): string {
  const clamped = Math.min(9, Math.max(0, level));
  return `var(--kidda-level-${clamped}-ink)`;
}

export function bandFillVar(band: CommunityBand): string {
  return `var(--kidda-band-${band}-fill)`;
}

export function bandInkVar(band: CommunityBand): string {
  return `var(--kidda-band-${band}-ink)`;
}
