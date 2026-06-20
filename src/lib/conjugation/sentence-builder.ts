import {
  buildGrammarTileLexicon,
  filterGrammarSentencesByTenseValue,
  lookupGrammarRomanised,
} from "@/lib/games/grammar-sentence";
import { pickCycledPool } from "@/lib/games/session-settings";
import type { GrammarSentence } from "@/lib/games/types";

export type SentenceBuilderQuestion = {
  id: string;
  sentenceId: string;
  englishPrompt: string;
  correctTiles: string[];
  correctTileRomanised: string[];
  romanised: string | null;
  tense: string | null;
};

export type SentenceTile = {
  id: string;
  word: string;
  romanised: string;
};

export type SentenceBuilderRoundResult = {
  questions: SentenceBuilderQuestion[];
  contentLimited: boolean;
  poolSize: number;
};

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function validSentenceRows(sentences: GrammarSentence[]): GrammarSentence[] {
  return sentences.filter(
    (sentence) =>
      sentence.word_tiles.length > 0 &&
      sentence.english_translation.trim().length > 0
  );
}

function pickDecoyTiles(
  question: SentenceBuilderQuestion,
  allSentences: GrammarSentence[],
  targetCount: number
): string[] {
  const correct = new Set(question.correctTiles);
  const candidates = new Set<string>();

  const sameTense = allSentences.filter(
    (sentence) => sentence.tense === question.tense && sentence.id !== question.sentenceId
  );
  const otherSentences =
    sameTense.length > 0 ? sameTense : allSentences.filter((sentence) => sentence.id !== question.sentenceId);

  for (const sentence of shuffle(otherSentences)) {
    for (const tile of sentence.word_tiles) {
      if (!correct.has(tile.gurmukhi)) candidates.add(tile.gurmukhi);
    }
    for (const distractor of sentence.distractor_conjugations) {
      if (!correct.has(distractor.gurmukhi)) candidates.add(distractor.gurmukhi);
    }
    if (candidates.size >= targetCount) break;
  }

  return shuffle([...candidates]).slice(0, targetCount);
}

export function buildSentenceQuestion(
  sentence: GrammarSentence,
  lexicon: Map<string, string>
): SentenceBuilderQuestion | null {
  const correctTiles = sentence.word_tiles.map((tile) => tile.gurmukhi).filter(Boolean);
  if (correctTiles.length === 0) return null;

  const correctTileRomanised = sentence.word_tiles.map((tile) => tile.romanised.trim());
  const romanised = correctTileRomanised.filter(Boolean).join(" ") || null;

  return {
    id: sentence.id,
    sentenceId: sentence.id,
    englishPrompt: sentence.english_translation,
    correctTiles,
    correctTileRomanised,
    romanised,
    tense: sentence.tense,
  };
}

export function buildTileBank(
  question: SentenceBuilderQuestion,
  allSentences: GrammarSentence[],
  lexicon: Map<string, string>
): SentenceTile[] {
  const decoyCount = Math.random() > 0.5 ? 2 : 1;
  const decoys = pickDecoyTiles(question, allSentences, decoyCount);

  const entries = [
    ...question.correctTiles.map((word, index) => ({
      word,
      romanised:
        question.correctTileRomanised[index] || lookupGrammarRomanised(lexicon, word),
    })),
    ...decoys.map((word) => ({
      word,
      romanised: lookupGrammarRomanised(lexicon, word),
    })),
  ];

  return shuffle(entries).map((entry, index) => ({
    id: `${question.id}-${entry.word}-${index}`,
    word: entry.word,
    romanised: entry.romanised,
  }));
}

export function buildSentenceRound(
  allSentences: GrammarSentence[],
  options: {
    questionCount: number;
    tenseFilter: string | string[];
  }
): SentenceBuilderRoundResult {
  const validAll = validSentenceRows(allSentences);
  const pool = filterGrammarSentencesByTenseValue(validAll, options.tenseFilter);
  const lexicon = buildGrammarTileLexicon(validAll);
  const picked = pickCycledPool(pool, options.questionCount);

  const questions: SentenceBuilderQuestion[] = [];
  picked.forEach((sentence, index) => {
    const question = buildSentenceQuestion(sentence, lexicon);
    if (question) {
      questions.push({
        ...question,
        id: `${question.sentenceId}-${index}`,
      });
    }
  });

  return {
    questions,
    contentLimited: pool.length < options.questionCount,
    poolSize: pool.length,
  };
}

export function answersMatch(built: string[], correct: string[]): boolean {
  if (built.length !== correct.length) return false;
  return built.every((word, index) => word === correct[index]);
}
