import type { TutorialId } from "./types";
import { isTutorialId } from "./types";

const STORAGE_KEY = "kidda.game-tutorial.seen.v1";

type SeenMap = Partial<Record<TutorialId, true>>;

function readSeenMap(): SeenMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const map: SeenMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (value === true && isTutorialId(key)) {
        map[key] = true;
      }
    }
    return map;
  } catch {
    return {};
  }
}

function writeSeenMap(map: SeenMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore quota / private mode failures.
  }
}

export function hasSeenGameTutorial(id: TutorialId): boolean {
  return readSeenMap()[id] === true;
}

export function markGameTutorialSeen(id: TutorialId): void {
  const map = readSeenMap();
  map[id] = true;
  writeSeenMap(map);
}

/** Clears seen state for one tutorial (useful for QA / “show again”). */
export function clearGameTutorialSeen(id: TutorialId): void {
  const map = readSeenMap();
  delete map[id];
  writeSeenMap(map);
}
