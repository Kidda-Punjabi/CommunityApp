import type { ConjugationResult, Gender, Person, TenseId, VerbWordLayout } from "./types";
import { latinRomanised } from "./romanised";

/**
 * Spacing rule per tense (Cases A–D from course material).
 * - separate_words: stem/infinitive + space + helper or ending word
 * - fused: root + ending → single word (habitual, simple past/future only)
 */
export const TENSE_VERB_WORD_LAYOUT: Record<TenseId, VerbWordLayout> = {
  present_habitual: "fused",
  present_continuous: "separate_words",
  present_ability: "separate_words",
  present_want: "separate_words",
  present_necessity: "separate_words",
  past_simple: "fused",
  past_perfect: "separate_words",
  past_habitual: "fused",
  past_continuous: "separate_words",
  past_ability: "separate_words",
  past_necessity: "separate_words",
  future_simple: "fused",
  future_perfect: "separate_words",
  future_ability: "separate_words",
  future_necessity: "separate_words",
};

export function verbWordLayoutForTense(tenseId: TenseId): VerbWordLayout {
  return TENSE_VERB_WORD_LAYOUT[tenseId];
}

/** Grammatical word tokens for the verb phrase (stem + ending), before joining with spaces. */
export function verbWordTokens(
  stem: string,
  ending: string,
  layout: VerbWordLayout
): string[] {
  if (!ending) return stem ? [stem] : [];
  if (layout === "separate_words") return [stem, ending];
  return [stem + ending];
}

export function verbWordParts(
  stem: string,
  ending: string,
  layout: VerbWordLayout
): string[] {
  return verbWordTokens(stem, ending, layout);
}

export function verbWordDisplay(
  stem: string,
  ending: string,
  layout: VerbWordLayout
): string {
  return verbWordTokens(stem, ending, layout).join(" ");
}

/** Matras/signs that visually attach to the preceding consonant (sihari, bihari, etc.). */
const ATTACHING_GURMUKHI_ENDING = /^[\u0A3E-\u0A4C\u0A70-\u0A71]/;

function endingAttachesToStemConsonant(ending: string): boolean {
  return ATTACHING_GURMUKHI_ENDING.test(ending);
}

/** Stem + ending display parts for UI (handles fused vs separate spacing). */
export function verbPhraseDisplayParts(
  stem: string,
  ending: string,
  layout: VerbWordLayout
): { prefix: string; suffix: string | null } {
  if (!ending) return { prefix: stem, suffix: null };
  if (layout === "separate_words") {
    return { prefix: stem, suffix: ending };
  }
  // Fused ending with sihari/bihari: include the final stem consonant in the
  // highlighted suffix so the matra renders violet (matras bind to prior letter).
  if (stem && endingAttachesToStemConsonant(ending)) {
    return {
      prefix: stem.slice(0, -1),
      suffix: stem.slice(-1) + ending,
    };
  }
  return { prefix: stem, suffix: ending };
}

/** Romanised verb form using the same token layout as Gurmukhi. */
export function getVerbWordRomanised(result: ConjugationResult): string {
  const stem = latinRomanised(result.stemRomanised) ?? "";
  const ending = latinRomanised(result.endingRomanised) ?? "";
  return verbWordDisplay(stem, ending, result.verbWordLayout);
}

export function tilesFromConjugationResult(result: ConjugationResult): string[] {
  const tiles = [result.pronoun];
  tiles.push(...verbWordTokens(result.root, result.ending, result.verbWordLayout));
  if (result.auxiliary) {
    tiles.push(result.auxiliary);
  }
  return tiles;
}

export function romanisedTilesFromConjugationResult(result: ConjugationResult): string[] {
  const pronoun = latinRomanised(result.pronounRomanised) ?? "";
  const stem = latinRomanised(result.stemRomanised) ?? "";
  const ending = latinRomanised(result.endingRomanised) ?? "";
  const tiles: string[] = [
    pronoun,
    ...verbWordTokens(stem, ending, result.verbWordLayout),
  ];
  if (result.auxiliary) {
    tiles.push(latinRomanised(result.auxiliaryRomanised) ?? "");
  }
  return tiles;
}

export function englishPersonLabel(person: Person, gender?: Gender): string {
  switch (person) {
    case "I":
      return "I";
    case "you":
    case "you_plural":
      return "you";
    case "he_she":
      if (gender === "masculine") return "he";
      if (gender === "feminine") return "she";
      return "he/she";
    case "we":
      return "we";
    case "they":
      return "they";
  }
}

export function glossVerb(english: string): string {
  return english.replace(/^to\s+/i, "");
}

/** Legacy display helper for dictionary entries stored as a single fused string. */
export function formatPunjabiForDisplay(text: string): string {
  const trimmed = text.trim();
  if (trimmed.includes(" ")) return trimmed;

  const match = trimmed.match(/^(.+?)(ਰਿਹਾ|ਰਹੀ|ਰਹੇ|ਰਹੀਆਂ|ਸਕਦਾ|ਸਕਦੀ|ਸਕਦੇ|ਸਕਦੀਆਂ)$/);
  if (match) {
    return `${match[1]} ${match[2]}`;
  }

  return trimmed;
}

export function joinRomanised(parts: Array<string | null | undefined>): string | null {
  const filtered = parts.filter((part): part is string => Boolean(part?.trim()));
  return filtered.length > 0 ? filtered.join(" ") : null;
}
