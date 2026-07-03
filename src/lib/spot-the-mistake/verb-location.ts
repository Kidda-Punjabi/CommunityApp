/**
 * Target-verb location in punjabi_sentence — mirrors Conjugation Challenge
 * `buildGapSentence` in `src/lib/conjugation/challenge.ts` (indexOf substring match,
 * not whitespace split). Keeps multi-word verb phrases intact.
 */
export function locateTargetVerbInSentence(
  punjabiSentence: string,
  targetVerbGurmukhi: string
): number {
  return punjabiSentence.indexOf(targetVerbGurmukhi.trim());
}

export function replaceTokenInSentence(
  punjabiSentence: string,
  tokenGurmukhi: string,
  replacementGurmukhi: string
): string | null {
  const token = tokenGurmukhi.trim();
  const index = punjabiSentence.indexOf(token);
  if (index === -1) return null;

  return (
    punjabiSentence.slice(0, index) +
    replacementGurmukhi.trim() +
    punjabiSentence.slice(index + token.length)
  );
}

/** @deprecated Use replaceTokenInSentence */
export function replaceTargetVerbInSentence(
  punjabiSentence: string,
  targetVerbGurmukhi: string,
  replacementGurmukhi: string
): string | null {
  return replaceTokenInSentence(punjabiSentence, targetVerbGurmukhi, replacementGurmukhi);
}
