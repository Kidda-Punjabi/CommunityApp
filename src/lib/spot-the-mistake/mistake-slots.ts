import {
  NECESSITY_PRESENT_AUX,
  OBLIQUE_PRONOUNS,
  PAST_AUX,
  PRESENT_AUX,
  SUBJECT_PRONOUNS,
} from "@/lib/conjugation/pronouns";
import type { WordTile } from "@/lib/games/types";
import { EXCLUDED_SWAP_DISTRACTOR_GURMUKHI } from "./distractors";

export type SpotMistakeKind = "verb" | "object";

export type SpotMistakeWord = {
  gurmukhi: string;
  romanised: string;
};

export type ObjectNounRef = {
  punjabi_word: string;
  romanised: string | null;
};

const FUNCTION_WORDS = new Set<string>(EXCLUDED_SWAP_DISTRACTOR_GURMUKHI);

for (const group of [
  SUBJECT_PRONOUNS,
  OBLIQUE_PRONOUNS,
  PRESENT_AUX,
  PAST_AUX,
  NECESSITY_PRESENT_AUX,
]) {
  for (const entry of Object.values(group)) {
    FUNCTION_WORDS.add(entry.punjabi);
  }
}

/** Common postpositions — not object swap targets. */
for (const word of ["ਵਿੱਚ", "ਨਾਲ", "ਤੋਂ", "ਲਈ", "ਦਾ", "ਦੀ", "ਦੇ", "ਨੂੰ"]) {
  FUNCTION_WORDS.add(word);
}

export function isSwappableObjectTile(
  tile: WordTile,
  targetVerb: string | null,
  targetVerbRoot: string | null,
  genderedNounWords: Set<string>
): boolean {
  const word = tile.gurmukhi.trim();
  if (!word || FUNCTION_WORDS.has(word)) return false;
  if (word === targetVerb?.trim() || word === targetVerbRoot?.trim()) return false;
  return genderedNounWords.has(word);
}

export function objectMistakeCandidates(
  wordTiles: WordTile[],
  targetVerb: string | null,
  targetVerbRoot: string | null,
  genderedNounWords: Set<string>
): WordTile[] {
  return wordTiles.filter((tile) =>
    isSwappableObjectTile(tile, targetVerb, targetVerbRoot, genderedNounWords)
  );
}

export function toMistakeWord(gurmukhi: string, romanised: string): SpotMistakeWord {
  return { gurmukhi: gurmukhi.trim(), romanised: romanised.trim() };
}
