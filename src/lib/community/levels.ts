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

export const LEVEL_NAMES = [
  "Sounds",
  "First words",
  "Everyday needs",
  "Past and future",
  "Joining ideas",
  "Opinions",
  "What if",
  "Natural speech",
  "Sayings and idioms",
  "Nuance and tone",
] as const;

export const LEVEL_CAN_DO: Record<number, string[]> = {
  0: ["Hear the Punjabi sounds English doesn't have", "Tell similar sounds apart"],
  1: ["Greet people and introduce yourself", "Talk about your family", "Ask simple questions"],
  2: ["Talk about your daily routine", "Say what you want and need", "Talk about food and what you like"],
  3: ["Talk about yesterday", "Talk about tomorrow", "Give a short presentation about yourself"],
  4: ["Join ideas with because, but and when", "Say what you can and can't do", "Tell a short story"],
  5: ["Give your opinion", "Agree and disagree politely", "Follow family conversation"],
  6: ["Talk about \"what if\"", "Adjust how polite you sound", "Hold a guided conversation for a few minutes"],
  7: ["Follow fast, natural Punjabi", "Reply without planning", "Keep up with relatives chatting"],
  8: ["Use idioms and sayings", "Switch tone between elders and friends"],
  9: ["Discuss deep topics with nuance", "Pick the right tone for any moment"],
};

export function levelName(level: number): string {
  return LEVEL_NAMES[Math.min(9, Math.max(0, level))] ?? "Level";
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
