import type { GroupGameType } from "@/lib/game-rooms/types";

export const RACE_GAME_TYPES = [
  "point_race",
  "sound_match_group",
  "vowel_match_group",
] as const satisfies readonly GroupGameType[];

export type RaceGameType = (typeof RACE_GAME_TYPES)[number];

export const RACE_WIN_SCORE_OPTIONS = [5, 10, 15, 20] as const;
export const DEFAULT_GROUP_RACE_WIN_SCORE = 10;

export function isRaceGameType(value: string | null | undefined): value is RaceGameType {
  return Boolean(value && (RACE_GAME_TYPES as readonly string[]).includes(value));
}

export function parseWinScore(
  raw: unknown,
  fallback = DEFAULT_GROUP_RACE_WIN_SCORE
): number {
  const value = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(50, Math.max(1, Math.round(value)));
}
