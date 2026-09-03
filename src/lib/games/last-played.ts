import {
  DEFAULT_PLAY_AGAIN_GAME,
  isPlayableGameId,
  playableIdFromPath,
  type PlayableGameId,
} from "@/lib/games/hub-config";

export const LAST_PLAYED_STORAGE_KEY = "kidda:last-played-game";

export function recordLastPlayedGame(id: PlayableGameId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_PLAYED_STORAGE_KEY, id);
  } catch {
    // Ignore storage failures (private mode, quota, etc.)
  }
}

export function readLastPlayedGame(): PlayableGameId | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(LAST_PLAYED_STORAGE_KEY);
    if (!value || !isPlayableGameId(value)) return null;
    return value;
  } catch {
    return null;
  }
}

export function resolvePlayAgainId(stored: PlayableGameId | null): PlayableGameId {
  if (stored === "word_start") return "sound_match";
  return stored ?? DEFAULT_PLAY_AGAIN_GAME;
}

export function recordLastPlayedFromPath(pathname: string): void {
  const id = playableIdFromPath(pathname);
  if (id) recordLastPlayedGame(id);
}
