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

/** Scribe often mis-tags Punjabi as Hindi and returns Devanagari (e.g. मेरा नाम है). */
const DEVANAGARI_RANGE = /[\u0900-\u097F]/;

const DEVANAGARI_INDEPENDENT: Record<string, string> = {
  अ: "a",
  आ: "a",
  इ: "i",
  ई: "i",
  उ: "u",
  ऊ: "u",
  ऋ: "ri",
  ए: "e",
  ऐ: "ai",
  ओ: "o",
  औ: "au",
};

const DEVANAGARI_CONSONANTS: Record<string, string> = {
  क: "k",
  ख: "kh",
  ग: "g",
  घ: "gh",
  ङ: "ng",
  च: "ch",
  छ: "chh",
  ज: "j",
  झ: "jh",
  ञ: "ny",
  ट: "t",
  ठ: "th",
  ड: "d",
  ढ: "dh",
  ण: "n",
  त: "t",
  थ: "th",
  द: "d",
  ध: "dh",
  न: "n",
  प: "p",
  फ: "ph",
  ब: "b",
  भ: "bh",
  म: "m",
  य: "y",
  र: "r",
  ल: "l",
  व: "v",
  श: "sh",
  ष: "sh",
  स: "s",
  ह: "h",
  ळ: "l",
  क़: "q",
  ख़: "kh",
  ग़: "g",
  ज़: "z",
  फ़: "f",
  ड़: "r",
  ढ़: "rh",
};

const DEVANAGARI_MATRAS: Record<string, string> = {
  "ा": "a",
  "ि": "i",
  "ी": "i",
  "ु": "u",
  "ू": "u",
  "ृ": "ri",
  "े": "e",
  "ै": "ai",
  "ो": "o",
  "ौ": "au",
};

const DEVANAGARI_VIRAMA = "्";
const DEVANAGARI_NUKTA = "़";
const DEVANAGARI_ANUSVARA = "ं";
const DEVANAGARI_CHANDRABINDU = "ँ";
const DEVANAGARI_VISARGA = "ः";

/**
 * Approximate Devanagari → Latin so Hindi-script STT of Punjabi can match
 * our romanised targets (mera naam hai ≈ मेरा नाम है).
 */
export function transliterateDevanagariToLatin(text: string): string {
  if (!DEVANAGARI_RANGE.test(text)) return text;

  let out = "";
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const withNukta = char + DEVANAGARI_NUKTA;
    const consonant =
      DEVANAGARI_CONSONANTS[withNukta] ?? DEVANAGARI_CONSONANTS[char];

    if (consonant) {
      if (DEVANAGARI_CONSONANTS[withNukta]) i += 1;
      const next = text[i + 1];
      if (next && DEVANAGARI_MATRAS[next]) {
        out += consonant + DEVANAGARI_MATRAS[next];
        i += 1;
      } else if (next === DEVANAGARI_VIRAMA) {
        out += consonant;
        i += 1;
      } else {
        // Word-final schwa is usually dropped (नाम → nam, not nama).
        const atWordEnd = !next || /\s|[।॰!?.,]/.test(next);
        out += atWordEnd ? consonant : `${consonant}a`;
      }
      continue;
    }

    if (DEVANAGARI_INDEPENDENT[char]) {
      out += DEVANAGARI_INDEPENDENT[char];
      continue;
    }
    if (DEVANAGARI_MATRAS[char]) {
      out += DEVANAGARI_MATRAS[char];
      continue;
    }
    if (
      char === DEVANAGARI_ANUSVARA ||
      char === DEVANAGARI_CHANDRABINDU
    ) {
      out += "n";
      continue;
    }
    if (char === DEVANAGARI_VISARGA) {
      out += "h";
      continue;
    }
    if (char === DEVANAGARI_VIRAMA || char === DEVANAGARI_NUKTA) {
      continue;
    }
    out += char;
  }

  return out;
}

function collapseVowelLength(text: string): string {
  return text
    .replace(/aa/g, "a")
    .replace(/ee/g, "i")
    .replace(/oo/g, "u")
    .replace(/ii/g, "i")
    .replace(/uu/g, "u");
}

const GURMUKHI_RANGE = /[\u0A00-\u0A7F]/;

const GURMUKHI_INDEPENDENT: Record<string, string> = {
  ਅ: "a",
  ਆ: "a",
  ਇ: "i",
  ਈ: "i",
  ਉ: "u",
  ਊ: "u",
  ਏ: "e",
  ਐ: "ai",
  ਓ: "o",
  ਔ: "au",
};

const GURMUKHI_CONSONANTS: Record<string, string> = {
  ਕ: "k",
  ਖ: "kh",
  ਗ: "g",
  ਘ: "gh",
  ਙ: "ng",
  ਚ: "ch",
  ਛ: "chh",
  ਜ: "j",
  ਝ: "jh",
  ਞ: "ny",
  ਟ: "t",
  ਠ: "th",
  ਡ: "d",
  ਢ: "dh",
  ਣ: "n",
  ਤ: "t",
  ਥ: "th",
  ਦ: "d",
  ਧ: "dh",
  ਨ: "n",
  ਪ: "p",
  ਫ: "ph",
  ਬ: "b",
  ਭ: "bh",
  ਮ: "m",
  ਯ: "y",
  ਰ: "r",
  ਲ: "l",
  ਵ: "v",
  ਸ਼: "sh",
  ਸ: "s",
  ਹ: "h",
  ਲ਼: "l",
  ਸ਼: "sh",
  ਖ਼: "kh",
  ਗ਼: "g",
  ਜ਼: "z",
  ਫ਼: "f",
  ਲ਼: "l",
};

const GURMUKHI_MATRAS: Record<string, string> = {
  "ਾ": "a",
  "ਿ": "i",
  "ੀ": "i",
  "ੁ": "u",
  "ੂ": "u",
  "ੇ": "e",
  "ੈ": "ai",
  "ੋ": "o",
  "ੌ": "au",
};

const GURMUKHI_VIRAMA = "੍";
const GURMUKHI_NUKTA = "਼";
const GURMUKHI_TIPPI = "ੰ";
const GURMUKHI_BINDI = "ਂ";
const GURMUKHI_ADDAK = "ੱ";

/**
 * Approximate Gurmukhi → Latin so "Heard" feedback is readable without
 * reading Punjabi script (ਮੈਂ ਠੀਕ ਹਾਂ → main thik han).
 */
export function transliterateGurmukhiToLatin(text: string): string {
  if (!GURMUKHI_RANGE.test(text)) return text;

  let out = "";
  let doubleNext = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (char === GURMUKHI_ADDAK) {
      doubleNext = true;
      continue;
    }

    const withNukta = char + GURMUKHI_NUKTA;
    const consonant =
      GURMUKHI_CONSONANTS[withNukta] ?? GURMUKHI_CONSONANTS[char];

    if (consonant) {
      if (GURMUKHI_CONSONANTS[withNukta]) i += 1;
      let sound = consonant;
      if (doubleNext) {
        sound = consonant + consonant;
        doubleNext = false;
      }
      const next = text[i + 1];
      if (next && GURMUKHI_MATRAS[next]) {
        out += sound + GURMUKHI_MATRAS[next];
        i += 1;
      } else if (next === GURMUKHI_VIRAMA) {
        out += sound;
        i += 1;
      } else {
        const atWordEnd = !next || /\s|[।.!?,]/.test(next) || next === GURMUKHI_TIPPI || next === GURMUKHI_BINDI;
        // Tippi/bindi after bare consonant: still word-ish; handle below after emit
        if (next === GURMUKHI_TIPPI || next === GURMUKHI_BINDI) {
          out += sound;
        } else {
          out += atWordEnd ? sound : `${sound}a`;
        }
      }
      continue;
    }

    if (GURMUKHI_INDEPENDENT[char]) {
      out += GURMUKHI_INDEPENDENT[char];
      continue;
    }
    if (GURMUKHI_MATRAS[char]) {
      out += GURMUKHI_MATRAS[char];
      continue;
    }
    if (char === GURMUKHI_TIPPI || char === GURMUKHI_BINDI) {
      out += "n";
      continue;
    }
    if (char === GURMUKHI_VIRAMA || char === GURMUKHI_NUKTA) {
      continue;
    }
    out += char;
  }

  return out;
}

function normalizeSpeechText(text: string): string {
  return collapseVowelLength(
    transliterateHomoglyphsToLatin(
      transliterateDevanagariToLatin(transliterateGurmukhiToLatin(text))
    )
      .trim()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/\s+/g, " ")
      .replace(/[.,!?;:'"()\-–—]/g, "")
      .toLowerCase()
  );
}

/** Latin-friendly transcript for display and romanised matching. */
export function normalizeSpeechTranscript(text: string): string {
  return normalizeSpeechText(text);
}

/**
 * What we show as "heard" — always prefer Latin so learners who don't read
 * Gurmukhi/Devanagari can tell what the mic picked up.
 */
export function formatHeardTranscript(transcript: string): string {
  const trimmed = transcript.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  if (GURMUKHI_RANGE.test(trimmed)) {
    return (
      transliterateGurmukhiToLatin(trimmed).trim().replace(/\s+/g, " ") ||
      trimmed
    );
  }
  if (DEVANAGARI_RANGE.test(trimmed)) {
    return (
      transliterateDevanagariToLatin(trimmed).trim().replace(/\s+/g, " ") ||
      trimmed
    );
  }
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
