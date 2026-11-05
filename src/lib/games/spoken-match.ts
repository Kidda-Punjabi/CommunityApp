import { normalizeSpeechTranscript } from "@/lib/games/voice-practice";

/**
 * Forgiving marking for spoken answers. Speech-to-text gives a rough spelling of
 * what was said, so this compares sounds word by word, in any order. Most of the
 * words being right is a pass. Typed answers keep their own stricter check.
 */
export const SPOKEN_PASS_THRESHOLD = 60;
const JOINED_PASS_RATIO = 0.7;

export type SpokenTarget = { romanised?: string | null; punjabi?: string | null };

/** Letters that the same spoken sound often comes back as, including Punjabi's tonal letters. */
function foldSounds(word: string): string {
  return word
    .replace(/chh|ch/g, "c")
    .replace(/kh|gh/g, "k")
    .replace(/jh/g, "c")
    .replace(/th|dh/g, "t")
    .replace(/bh/g, "p")
    .replace(/ph/g, "f")
    .replace(/sh/g, "s")
    .replace(/z/g, "j")
    .replace(/w/g, "v")
    .replace(/q/g, "k")
    .replace(/ai|ei|ay/g, "e")
    .replace(/au|ou/g, "o")
    .replace(/(?!^)h/g, "")
    .replace(/(.)\1+/g, "$1")
    .replace(/([aeiou])n$/, "$1");
}

const SAME_START: Record<string, string> = { g: "k", j: "c", d: "t", b: "p", y: "j" };
const startSound = (word: string) => SAME_START[word[0]] ?? word[0];

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

const asWords = (text: string) =>
  normalizeSpeechTranscript(text).split(/[\s/]+/).map(foldSounds).filter(Boolean);

/** Same word, allowing a slip: one letter in a short word, about a third in a long one. */
function sameWord(heard: string, target: string): boolean {
  if (heard === target) return true;
  if (startSound(heard) !== startSound(target)) return false;
  const allowed = Math.max(1, Math.floor(Math.max(heard.length, target.length) / 3));
  return editDistance(heard, target) <= allowed;
}

function scoreAgainst(transcript: string, target: string): number {
  const heard = asWords(transcript);
  const wanted = asWords(target);
  if (!heard.length || !wanted.length) return 0;

  const unused = [...heard];
  let found = 0;
  for (const word of wanted) {
    const at = unused.findIndex((candidate) => sameWord(candidate, word));
    if (at >= 0) {
      unused.splice(at, 1);
      found += 1;
    }
  }
  const byWord = Math.round((found / wanted.length) * 100);

  // Word breaks often land in different places, so also compare it all run together.
  const heardJoined = heard.join("");
  const wantedJoined = wanted.join("");
  if (wanted.length === 1) return sameWord(heardJoined, wantedJoined) ? 100 : byWord;
  const ratio = 1 - editDistance(heardJoined, wantedJoined) / Math.max(heardJoined.length, wantedJoined.length);
  return ratio >= JOINED_PASS_RATIO ? Math.max(byWord, Math.round(ratio * 100)) : byWord;
}

/** 0 to 100, the best match against the romanised and Gurmukhi versions. */
export function scoreSpokenAttempt(transcript: string, target: SpokenTarget): number {
  return Math.max(
    target.romanised?.trim() ? scoreAgainst(transcript, target.romanised) : 0,
    target.punjabi?.trim() ? scoreAgainst(transcript, target.punjabi) : 0
  );
}

export function passedSpokenAttempt(score: number): boolean {
  return score >= SPOKEN_PASS_THRESHOLD;
}
