/**
 * Sentence Tiles distractor pool (Everyday Punjabi practice).
 * Distractors are generated from other flashcards in the same deck.
 */

const TRAILING_PUNCTUATION = /[?.,!।॥]+$/u;

/** Trim and drop trailing punctuation so "ਦੋ" and "ਦੋ?" count as the same word. */
export function normaliseTileGurmukhi(word: string): string {
  return word.trim().replace(TRAILING_PUNCTUATION, "").trim();
}

export type SentenceTileWord = {
  gurmukhi: string;
  romanised: string;
};

/**
 * How many distractors a phrase asks for.
 * Short phrases (under 4 words) ask for 1; longer phrases ask for 2.
 * Capped by the answer length, matching the previous Sentence Tiles rule.
 */
export function sentenceTileDistractorTarget(answerWordCount: number): number {
  return Math.min(answerWordCount >= 4 ? 2 : 1, Math.max(1, answerWordCount));
}

/**
 * Every distractor the deck can offer, one tile per normalised Gurmukhi word.
 * Words already in the answer are left out. Callers trim this to the target
 * count; a short deck stays short instead of repeating a word.
 */
export function uniqueSentenceTileDistractors(
  answerWords: string[],
  deckWords: SentenceTileWord[]
): SentenceTileWord[] {
  const answerNorms = new Set(
    answerWords.map((word) => normaliseTileGurmukhi(word)).filter(Boolean)
  );
  const seen = new Set<string>();
  const unique: SentenceTileWord[] = [];

  for (const part of deckWords) {
    const norm = normaliseTileGurmukhi(part.gurmukhi);
    if (!norm || answerNorms.has(norm) || seen.has(norm)) continue;
    seen.add(norm);
    unique.push(part);
  }

  return unique;
}

/** First `targetCount` unique distractors. Fewer when the deck cannot fill the target. */
export function selectSentenceTileDistractors(
  answerWords: string[],
  deckWords: SentenceTileWord[],
  targetCount: number
): SentenceTileWord[] {
  const unique = uniqueSentenceTileDistractors(answerWords, deckWords);
  if (targetCount <= 0 || unique.length <= targetCount) return unique;
  return unique.slice(0, targetCount);
}

/** True when the tapped tiles are the answer words in order, ignoring tile ids. */
export function gurmukhiSequenceMatches(built: string[], target: string[]): boolean {
  if (built.length !== target.length) return false;
  return built.every(
    (word, index) =>
      normaliseTileGurmukhi(word) === normaliseTileGurmukhi(target[index] ?? "")
  );
}
