import {
  LETTER_SPAWN_MAX_MS,
  LETTER_SPAWN_MIN_MS,
} from "./config";

export const KIDDA_TARGET_LETTERS = ["K", "I", "D", "D", "A"] as const;

export type KiddaLetter = (typeof KIDDA_TARGET_LETTERS)[number];

export type LetterSlot = {
  letter: KiddaLetter;
  filled: boolean;
};

export function createEmptyLetterSlots(): LetterSlot[] {
  return KIDDA_TARGET_LETTERS.map((letter) => ({ letter, filled: false }));
}

/** Next letter that still has an open slot, or null if all filled. */
export function nextSpawnableLetter(slots: LetterSlot[]): KiddaLetter | null {
  for (const slot of slots) {
    if (!slot.filled) return slot.letter;
  }
  return null;
}

/** Fill the earliest empty slot matching this letter. Returns new slots + whether anything changed. */
export function fillEarliestLetterSlot(
  slots: LetterSlot[],
  letter: KiddaLetter
): { slots: LetterSlot[]; filled: boolean; completed: boolean } {
  const next = slots.map((slot) => ({ ...slot }));
  const index = next.findIndex((slot) => !slot.filled && slot.letter === letter);
  if (index < 0) {
    return { slots: next, filled: false, completed: false };
  }
  next[index].filled = true;
  const completed = next.every((slot) => slot.filled);
  return { slots: next, filled: true, completed };
}

export function randomLetterSpawnDelayMs(): number {
  const span = LETTER_SPAWN_MAX_MS - LETTER_SPAWN_MIN_MS;
  return LETTER_SPAWN_MIN_MS + Math.floor(Math.random() * span);
}
