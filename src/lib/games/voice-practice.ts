import {
  buildRomanisedSentenceFromTiles,
  filterGrammarSentencesByTenseValue,
} from "@/lib/games/grammar-sentence";
import type { GrammarSentence } from "@/lib/games/types";
import type { GameSessionSettingsChoice } from "@/lib/games/session-settings";

export const VOICE_PRACTICE_PASS_THRESHOLD = 80;
export const VOICE_PRACTICE_MAX_ATTEMPTS = 2;

export type VoicePracticeQuestionResult = {
  sentence_id: string;
  best_similarity: number;
  passed: boolean;
  attempts: number;
};

export type VoicePracticeRound = {
  questions: GrammarSentence[];
  requestedCount: number;
  tenseFilter: string[];
};

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function isPlayableVoiceSentence(sentence: GrammarSentence): boolean {
  return sentence.punjabi_sentence.trim().length > 0;
}

export function buildVoicePracticeRound(
  sentences: GrammarSentence[],
  choice: GameSessionSettingsChoice
): VoicePracticeRound {
  const pool = filterGrammarSentencesByTenseValue(
    sentences.filter(isPlayableVoiceSentence),
    choice.filterIds
  );

  const requestedCount = choice.questionCount;
  const questions = shuffle(pool).slice(0, Math.min(requestedCount, pool.length));

  return {
    questions,
    requestedCount,
    tenseFilter: choice.filterIds,
  };
}

export function romanisedHint(sentence: GrammarSentence): string | null {
  const line = buildRomanisedSentenceFromTiles(sentence).trim();
  return line || null;
}

function normalizeSpeechText(text: string): string {
  return text
    .trim()
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .replace(/[.,!?;:'"()\-–—]/g, "");
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

/** Similarity percentage from normalized Levenshtein distance (0–100). */
export function speechSimilarityPercent(transcript: string, target: string): number {
  const a = normalizeSpeechText(transcript);
  const b = normalizeSpeechText(target);

  if (!a && !b) return 100;
  if (!a || !b) return 0;
  if (a === b) return 100;

  const distance = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return Math.round((1 - distance / maxLen) * 100);
}

export function passedVoiceAttempt(similarity: number): boolean {
  return similarity >= VOICE_PRACTICE_PASS_THRESHOLD;
}
