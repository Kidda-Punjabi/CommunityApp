import { shuffleArray } from "@/lib/flashcards/utils";
import type { DistractorConjugation, GrammarSentence } from "@/lib/games/types";
import type { ObjectNounRef, SpotMistakeWord } from "./mistake-slots";
import { usableDistractorConjugations } from "./distractors";

export const SPOT_FIX_OPTION_COUNT = 4;

export function buildGlobalVerbOptionPool(sentences: GrammarSentence[]): SpotMistakeWord[] {
  const pool: SpotMistakeWord[] = [];
  const seen = new Set<string>();

  const add = (gurmukhi: string, romanised: string) => {
    const word = gurmukhi.trim();
    if (!word || seen.has(word)) return;
    seen.add(word);
    pool.push({ gurmukhi: word, romanised: romanised.trim() });
  };

  for (const sentence of sentences) {
    add(sentence.target_verb_gurmukhi ?? "", sentence.target_verb_romanised ?? "");
    for (const distractor of usableDistractorConjugations(sentence)) {
      add(distractor.gurmukhi, distractor.romanised);
    }
  }

  return pool;
}

export function buildGlobalObjectOptionPool(genderedNouns: ObjectNounRef[]): SpotMistakeWord[] {
  const pool: SpotMistakeWord[] = [];
  const seen = new Set<string>();

  for (const noun of genderedNouns) {
    const word = noun.punjabi_word.trim();
    if (!word || seen.has(word)) continue;
    seen.add(word);
    pool.push({ gurmukhi: word, romanised: noun.romanised?.trim() ?? "" });
  }

  return pool;
}

export function buildFixOptions(
  correct: SpotMistakeWord,
  mistake: SpotMistakeWord,
  sentenceSpecific: DistractorConjugation[],
  globalPool: SpotMistakeWord[]
): { options: Array<{ id: string; gurmukhi: string; romanised: string }>; correctOptionId: string } {
  const seen = new Set<string>();
  const options: Array<{ id: string; gurmukhi: string; romanised: string }> = [];

  const add = (word: SpotMistakeWord, id: string) => {
    if (!word.gurmukhi || seen.has(word.gurmukhi)) return;
    seen.add(word.gurmukhi);
    options.push({ id, gurmukhi: word.gurmukhi, romanised: word.romanised });
  };

  add(correct, "correct");

  const wrongCandidates: SpotMistakeWord[] = [
    mistake,
    ...sentenceSpecific.map((entry) => ({
      gurmukhi: entry.gurmukhi,
      romanised: entry.romanised,
    })),
    ...globalPool,
  ];

  for (const candidate of wrongCandidates) {
    if (options.length >= SPOT_FIX_OPTION_COUNT) break;
    if (candidate.gurmukhi === correct.gurmukhi) continue;
    add(candidate, `wrong-${candidate.gurmukhi}`);
  }

  while (options.length < SPOT_FIX_OPTION_COUNT && globalPool.length > 0) {
    for (const candidate of globalPool) {
      if (options.length >= SPOT_FIX_OPTION_COUNT) break;
      if (candidate.gurmukhi === correct.gurmukhi) continue;
      add(candidate, `pad-${options.length}-${candidate.gurmukhi}`);
    }
    break;
  }

  const shuffled = shuffleArray(options);

  return {
    options: shuffled.slice(0, SPOT_FIX_OPTION_COUNT),
    correctOptionId: "correct",
  };
}
