import type { DistractorConjugation, GrammarSentence } from "@/lib/games/types";
import { parseDistractorConjugations } from "@/lib/games/grammar-sentence";

/** Copulas excluded from swap-in mistakes — not conjugation-agreement errors. */
export const EXCLUDED_SWAP_DISTRACTOR_GURMUKHI = new Set(["ਹੈ", "ਹਨ", "ਸੀ", "ਸਨ"]);

export function usableDistractorConjugations(
  sentence: GrammarSentence
): DistractorConjugation[] {
  return parseDistractorConjugations(sentence.distractor_conjugations).filter(
    (entry) =>
      !EXCLUDED_SWAP_DISTRACTOR_GURMUKHI.has(entry.gurmukhi.trim()) &&
      entry.gurmukhi.trim() !== sentence.target_verb_gurmukhi?.trim()
  );
}

export function isSpotTheMistakeEligible(sentence: GrammarSentence): boolean {
  if (!sentence.target_verb_gurmukhi?.trim()) return false;
  return usableDistractorConjugations(sentence).length > 0;
}

export type SuspiciousDistractorFlag = {
  sentenceId: string;
  targetVerbGurmukhi: string;
  distractorGurmukhi: string;
  lengthDelta: number;
};

/**
 * Heuristic for human review only — logs distractors whose Gurmukhi length differs
 * from target_verb_gurmukhi by more than one character (possible unrelated word).
 */
export function collectSuspiciousDistractors(
  sentences: GrammarSentence[]
): SuspiciousDistractorFlag[] {
  const flags: SuspiciousDistractorFlag[] = [];

  for (const sentence of sentences) {
    const target = sentence.target_verb_gurmukhi?.trim();
    if (!target) continue;

    for (const distractor of usableDistractorConjugations(sentence)) {
      const delta = Math.abs(distractor.gurmukhi.length - target.length);
      if (delta > 1) {
        flags.push({
          sentenceId: sentence.id,
          targetVerbGurmukhi: target,
          distractorGurmukhi: distractor.gurmukhi,
          lengthDelta: delta,
        });
      }
    }
  }

  return flags;
}

export function logSuspiciousDistractorsForReview(sentences: GrammarSentence[]): void {
  const flags = collectSuspiciousDistractors(sentences);
  if (flags.length === 0) return;

  console.log(
    "[Spot the Mistake] Distractors with Gurmukhi length mismatch > 1 — review with Gurupma:",
    flags
  );
}
