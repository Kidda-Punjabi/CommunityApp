import {
  buildGapSentenceRomanised,
  filterGrammarSentencesByTenseValue,
  formatGrammarTenseLabel,
  parseDistractorConjugations,
  tenseGroupFromGrammarTense,
} from "@/lib/games/grammar-sentence";
import { pickCycledPool } from "@/lib/games/session-settings";
import type { GrammarSentence } from "@/lib/games/types";
import type { PunjabiOption } from "./distractors";
import type { TenseGroup, TenseId } from "./types";
import { TENSE_CATALOG } from "./types";

export {
  filterGrammarSentencesByTenseValue,
  grammarTenseFilterOptions,
} from "@/lib/games/grammar-sentence";

export type { PunjabiOption as ChallengeOption } from "./distractors";

export const CHALLENGE_ROUND_LENGTH = 10;

export type ChallengeFormat = "A" | "B";

export type ChallengeQuestion = {
  id: string;
  sentenceId: string;
  format: ChallengeFormat;
  correctAnswer: string;
  correctAnswerRomanised: string;
  options: PunjabiOption[];
  englishGloss: string;
  tenseLabel: string;
  tenseGroup: TenseGroup;
  verbRoot: string;
  verbRootRomanised: string;
  english: string;
  gapSentence?: string;
  gapSentenceRomanised?: string;
};

export type ChallengeRoundResult = {
  questions: ChallengeQuestion[];
  contentLimited: boolean;
  usedBroaderPool: boolean;
  poolSize: number;
};

export type GroupBreakdown = Record<TenseGroup, { correct: number; total: number }>;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function getTensesForFocus(
  focus: TenseGroup | "all",
  selectedTenseIds: Set<TenseId>
): TenseId[] {
  const fromSelection = TENSE_CATALOG.filter((tense) => selectedTenseIds.has(tense.id)).map(
    (tense) => tense.id
  );

  if (focus === "all") {
    return fromSelection;
  }

  return fromSelection.filter((tenseId) => {
    const meta = TENSE_CATALOG.find((tense) => tense.id === tenseId);
    return meta?.group === focus;
  });
}

export function defaultTenseSelectionForFocus(focus: TenseGroup | "all"): Set<TenseId> {
  if (focus === "all") {
    return new Set(TENSE_CATALOG.map((tense) => tense.id));
  }
  return new Set(
    TENSE_CATALOG.filter((tense) => tense.group === focus).map((tense) => tense.id)
  );
}

function conjugationReadyRows(sentences: GrammarSentence[]): GrammarSentence[] {
  return sentences.filter((sentence) => {
    if (!sentence.target_verb_gurmukhi?.trim()) return false;
    const distractors = parseDistractorConjugations(sentence.distractor_conjugations);
    return distractors.length >= 2;
  });
}

function buildGapSentence(sentence: GrammarSentence): string | undefined {
  const verb = sentence.target_verb_gurmukhi?.trim();
  if (!verb) return undefined;

  const index = sentence.punjabi_sentence.indexOf(verb);
  if (index === -1) return undefined;

  return (
    sentence.punjabi_sentence.slice(0, index) +
    "___" +
    sentence.punjabi_sentence.slice(index + verb.length)
  );
}

function buildChallengeQuestion(
  sentence: GrammarSentence,
  format: ChallengeFormat
): ChallengeQuestion | null {
  const correctVerb = sentence.target_verb_gurmukhi?.trim();
  if (!correctVerb) return null;

  const distractors = parseDistractorConjugations(sentence.distractor_conjugations);
  if (distractors.length < 2) return null;

  const correctOption: PunjabiOption = {
    punjabi: correctVerb,
    romanised: sentence.target_verb_romanised?.trim() ?? "",
  };

  const options = shuffle([
    correctOption,
    ...distractors.map((distractor) => ({
      punjabi: distractor.gurmukhi,
      romanised: distractor.romanised,
    })),
  ]);

  return {
    id: sentence.id,
    sentenceId: sentence.id,
    format,
    correctAnswer: correctOption.punjabi,
    correctAnswerRomanised: correctOption.romanised,
    options,
    englishGloss: sentence.english_translation,
    tenseLabel: formatGrammarTenseLabel(sentence.tense),
    tenseGroup: tenseGroupFromGrammarTense(sentence.tense),
    verbRoot: sentence.target_verb_root_gurmukhi?.trim() ?? correctVerb,
    verbRootRomanised: sentence.target_verb_root_romanised?.trim() ?? "",
    english: sentence.english_translation,
    gapSentence: format === "B" ? buildGapSentence(sentence) : undefined,
    gapSentenceRomanised: format === "B" ? buildGapSentenceRomanised(sentence) : undefined,
  };
}

export function buildChallengeRound(
  allSentences: GrammarSentence[],
  options: {
    questionCount: number;
    tenseFilter: string | string[];
  }
): ChallengeRoundResult {
  const validAll = conjugationReadyRows(allSentences);
  const pool = filterGrammarSentencesByTenseValue(validAll, options.tenseFilter);
  const picked = pickCycledPool(pool, options.questionCount);

  const questions: ChallengeQuestion[] = [];
  picked.forEach((sentence, index) => {
    const format: ChallengeFormat = index % 3 === 1 ? "B" : "A";
    const question = buildChallengeQuestion(sentence, format);
    if (question) {
      const resolved =
        question.format === "B" && !question.gapSentence
          ? { ...question, format: "A" as const, gapSentence: undefined, gapSentenceRomanised: undefined }
          : question;
      questions.push({
        ...resolved,
        id: `${resolved.sentenceId}-${index}`,
      });
    }
  });

  return {
    questions,
    contentLimited: pool.length < options.questionCount,
    usedBroaderPool: false,
    poolSize: pool.length,
  };
}

export function computeGroupBreakdown(
  questions: ChallengeQuestion[],
  results: boolean[]
): GroupBreakdown {
  const breakdown: GroupBreakdown = {
    present: { correct: 0, total: 0 },
    past: { correct: 0, total: 0 },
    future: { correct: 0, total: 0 },
  };

  questions.forEach((question, index) => {
    breakdown[question.tenseGroup].total += 1;
    if (results[index]) {
      breakdown[question.tenseGroup].correct += 1;
    }
  });

  return breakdown;
}
