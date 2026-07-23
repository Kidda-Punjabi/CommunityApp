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

/** Multi-char replacements must run before single-char mapping. */
const CYRILLIC_MULTI_TO_LATIN: [string, string][] = [
  ["щ", "shch"],
  ["Щ", "shch"],
  ["ш", "sh"],
  ["Ш", "sh"],
  ["ч", "ch"],
  ["Ч", "ch"],
  ["ж", "zh"],
  ["Ж", "zh"],
  ["ю", "yu"],
  ["Ю", "yu"],
  ["я", "ya"],
  ["Я", "ya"],
  ["ё", "yo"],
  ["Ё", "yo"],
];

const CYRILLIC_SINGLE_TO_LATIN: Record<string, string> = {
  а: "a",
  А: "a",
  б: "b",
  Б: "b",
  в: "v",
  В: "v",
  г: "g",
  Г: "g",
  д: "d",
  Д: "d",
  е: "e",
  Е: "e",
  з: "z",
  З: "z",
  и: "i",
  И: "i",
  й: "y",
  Й: "y",
  к: "k",
  К: "k",
  л: "l",
  Л: "l",
  м: "m",
  М: "m",
  н: "n",
  Н: "n",
  о: "o",
  О: "o",
  п: "p",
  П: "p",
  р: "r",
  Р: "r",
  с: "s",
  С: "s",
  т: "t",
  Т: "t",
  у: "u",
  У: "u",
  ф: "f",
  Ф: "f",
  х: "h",
  Х: "h",
  ц: "ts",
  Ц: "ts",
  ъ: "",
  Ъ: "",
  ы: "y",
  Ы: "y",
  ь: "",
  Ь: "",
  э: "e",
  Э: "e",
};

/**
 * Scribe sometimes returns Cyrillic lookalikes for spoken Punjabi romanisation
 * (e.g. "Сочно" for "sochna"). Map those to Latin before fuzzy matching.
 */
export function transliterateHomoglyphsToLatin(text: string): string {
  let result = text;
  for (const [from, to] of CYRILLIC_MULTI_TO_LATIN) {
    result = result.split(from).join(to);
  }
  return [...result].map((char) => CYRILLIC_SINGLE_TO_LATIN[char] ?? char).join("");
}

function normalizeSpeechText(text: string): string {
  return transliterateHomoglyphsToLatin(text)
    .trim()
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .replace(/[.,!?;:'"()\-–—]/g, "")
    .toLowerCase();
}

/** Latin-friendly transcript for display and romanised matching. */
export function normalizeSpeechTranscript(text: string): string {
  return normalizeSpeechText(text);
}

const GURMUKHI = /[\u0A00-\u0A7F]/;

/**
 * What we show as "heard" — prefer readable Latin when Scribe returned romanisation,
 * otherwise keep Gurmukhi as spoken-script output.
 */
export function formatHeardTranscript(transcript: string): string {
  const trimmed = transcript.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  if (GURMUKHI.test(trimmed)) return trimmed;
  return normalizeSpeechTranscript(trimmed) || trimmed;
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
