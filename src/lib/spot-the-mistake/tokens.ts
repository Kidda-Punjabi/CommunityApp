import {
  buildRomanisedSentenceFromTiles,
  lookupGrammarRomanised,
} from "@/lib/games/grammar-sentence";
import type { GrammarSentence } from "@/lib/games/types";
import type { SpotMistakeWord } from "./mistake-slots";
import { replaceTokenInSentence } from "./verb-location";
import type { SpotSentenceToken } from "./types";

export function buildBrokenRomanisedLine(
  sentence: GrammarSentence,
  slotGurmukhi: string,
  mistake: SpotMistakeWord,
  lexicon: Map<string, string>
): string {
  if (sentence.word_tiles.length > 0) {
    const line = sentence.word_tiles
      .map((tile) => {
        const latin =
          tile.gurmukhi === slotGurmukhi
            ? mistake.romanised.trim() || lookupGrammarRomanised(lexicon, mistake.gurmukhi)
            : tile.romanised.trim() || lookupGrammarRomanised(lexicon, tile.gurmukhi);
        return latin;
      })
      .filter(Boolean)
      .join(" ");

    if (line) return line;
  }

  const slotRomanised =
    sentence.word_tiles.find((tile) => tile.gurmukhi === slotGurmukhi)?.romanised.trim() ||
    lookupGrammarRomanised(lexicon, slotGurmukhi);

  if (slotRomanised) {
    const fullLine = buildRomanisedSentenceFromTiles(sentence);
    if (fullLine) {
      const index = fullLine.indexOf(slotRomanised);
      if (index !== -1) {
        const replacement =
          mistake.romanised.trim() || lookupGrammarRomanised(lexicon, mistake.gurmukhi);
        return fullLine.slice(0, index) + replacement + fullLine.slice(index + slotRomanised.length);
      }
    }
  }

  return mistake.romanised.trim();
}

export function buildCorrectedRomanisedLine(
  sentence: GrammarSentence,
  lexicon: Map<string, string>
): string {
  if (sentence.word_tiles.length > 0) {
    const line = buildRomanisedSentenceFromTiles(sentence);
    if (line) return line;
  }

  const targetRomanised = sentence.target_verb_romanised?.trim();
  return targetRomanised || lookupGrammarRomanised(lexicon, sentence.target_verb_gurmukhi ?? "");
}

export function tokenizeBrokenSentence(
  sentence: GrammarSentence,
  slotGurmukhi: string,
  mistake: SpotMistakeWord,
  lexicon: Map<string, string>
): SpotSentenceToken[] {
  if (sentence.word_tiles.length > 0) {
    return sentence.word_tiles.map((tile, index) => {
      const isMistakeSlot = tile.gurmukhi === slotGurmukhi;
      return {
        id: `${sentence.id}-tile-${index}`,
        gurmukhi: isMistakeSlot ? mistake.gurmukhi : tile.gurmukhi,
        romanised: isMistakeSlot
          ? mistake.romanised.trim() || lookupGrammarRomanised(lexicon, mistake.gurmukhi)
          : tile.romanised.trim() || lookupGrammarRomanised(lexicon, tile.gurmukhi),
        isMistake: isMistakeSlot,
      };
    });
  }

  const broken = replaceTokenInSentence(sentence.punjabi_sentence, slotGurmukhi, mistake.gurmukhi);
  if (!broken) return [];

  return broken
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => ({
      id: `${sentence.id}-word-${index}`,
      gurmukhi: word,
      romanised:
        word === mistake.gurmukhi
          ? mistake.romanised.trim() || lookupGrammarRomanised(lexicon, word)
          : lookupGrammarRomanised(lexicon, word),
      isMistake: word === mistake.gurmukhi,
    }));
}

export function tokenizeCorrectedSentence(
  sentence: GrammarSentence,
  slotGurmukhi: string,
  lexicon: Map<string, string>
): SpotSentenceToken[] {
  if (sentence.word_tiles.length > 0) {
    return sentence.word_tiles.map((tile, index) => ({
      id: `${sentence.id}-correct-${index}`,
      gurmukhi: tile.gurmukhi,
      romanised: tile.romanised.trim() || lookupGrammarRomanised(lexicon, tile.gurmukhi),
      isMistake: tile.gurmukhi === slotGurmukhi,
    }));
  }

  return sentence.punjabi_sentence
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => ({
      id: `${sentence.id}-correct-${index}`,
      gurmukhi: word,
      romanised: lookupGrammarRomanised(lexicon, word),
      isMistake: word === slotGurmukhi,
    }));
}
