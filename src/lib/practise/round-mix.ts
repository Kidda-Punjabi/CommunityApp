import type { PractiseSkill } from "./types";

/** A round aims for 75% new and 25% already seen. New never drops below 60% while new items are left. */
export const KNOWN_SHARE = 0.25;

/** Seen in any skill. A sentence met in Listening is no longer new in Speaking. */
export function seenAnywhere(progress: Map<string, number>, id: string): boolean {
  return (["words", "grammar", "listening", "speaking"] as PractiseSkill[]).some((skill) => progress.has(`${skill}:${id}`));
}

/** Review slots for each skill. Words has the most new material, so it gets a review slot last. */
export function knownSlotsBySkill(skills: PractiseSkill[], roundSize: number): Map<PractiseSkill, number> {
  const slots = new Map<PractiseSkill, number>(skills.map((skill) => [skill, 0]));
  const order = [...skills.filter((s) => s !== "words"), ...skills.filter((s) => s === "words")];
  let left = Math.round(roundSize * KNOWN_SHARE);
  for (let i = 0; left > 0 && order.length > 0; i += 1, left -= 1) {
    const skill = order[i % order.length];
    slots.set(skill, (slots.get(skill) ?? 0) + 1);
  }
  return slots;
}

/**
 * Splits n questions into new and known. Lists come in the order to use them.
 * `shortOfNew` is what is missing from the new share, for the caller to fill from elsewhere.
 */
export function pickMix<T>(unseen: T[], known: T[], n: number, knownSlots: number) {
  const knownWanted = Math.min(knownSlots, known.length, n);
  const newWanted = n - knownWanted;
  const fresh = unseen.slice(0, newWanted);
  const review = known.slice(0, knownWanted);
  return { fresh, review, known: known.slice(knownWanted), shortOfNew: newWanted - fresh.length };
}
