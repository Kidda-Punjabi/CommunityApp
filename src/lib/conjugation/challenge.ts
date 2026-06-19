import { conjugate } from "./conjugate";
import {
  buildGapSentence,
  formatTenseLabel,
  generateSentenceDistractors,
  generateVerbWordDistractors,
  getVerbWord,
} from "./distractors";
import { PERSON_OPTIONS } from "./types";
import type { Gender, Person, TenseGroup, TenseId, Verb } from "./types";
import { TENSE_CATALOG } from "./types";

export const CHALLENGE_ROUND_LENGTH = 10;

export type ChallengeFormat = "A" | "B" | "C";

export type ChallengeQuestion = {
  format: ChallengeFormat;
  verb: Verb;
  tenseId: TenseId;
  tenseGroup: TenseGroup;
  person: Person;
  gender: Gender;
  correctAnswer: string;
  options: string[];
  englishGloss: string;
  tenseLabel: string;
  pronounDisplay: string;
  verbRoot: string;
  english: string;
  gapSentence?: string;
};

const FORMAT_POOL: ChallengeFormat[] = ["A", "A", "A", "B", "B", "B", "B", "C", "C", "C"];

const ALL_PERSONS: Person[] = ["I", "you", "he_she", "we", "you_plural", "they"];
const ALL_GENDERS: Gender[] = ["masculine", "feminine"];

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
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

function buildFormatSequence(canUseFormatC: boolean): ChallengeFormat[] {
  const formats = shuffle(FORMAT_POOL);
  if (canUseFormatC) return formats;

  return formats.map((format) => (format === "C" ? (Math.random() > 0.5 ? "A" : "B") : format));
}

function pronounDisplay(resultPronoun: string, person: Person): string {
  const label = PERSON_OPTIONS.find((option) => option.person === person)?.label ?? person;
  return `${resultPronoun} / ${label}`;
}

function sampleQuestionParams(
  verbs: Verb[],
  availableTenses: TenseId[]
): { verb: Verb; tenseId: TenseId; person: Person; gender: Gender } {
  return {
    verb: pickRandom(verbs),
    tenseId: pickRandom(availableTenses),
    person: pickRandom(ALL_PERSONS),
    gender: pickRandom(ALL_GENDERS),
  };
}

function buildQuestion(
  format: ChallengeFormat,
  verb: Verb,
  tenseId: TenseId,
  person: Person,
  gender: Gender,
  availableTenses: TenseId[]
): ChallengeQuestion | null {
  const correct = conjugate(verb, tenseId, person, gender);
  const tenseMeta = TENSE_CATALOG.find((tense) => tense.id === tenseId);
  const tenseLabel = formatTenseLabel(tenseId);
  const pronoun = pronounDisplay(correct.pronoun, person);

  if (format === "C") {
    const distractors = generateSentenceDistractors(
      verb,
      tenseId,
      person,
      gender,
      availableTenses,
      3
    );
    if (distractors.length < 3) return null;

    return {
      format,
      verb,
      tenseId,
      tenseGroup: tenseMeta!.group,
      person,
      gender,
      correctAnswer: correct.fullPunjabi,
      options: shuffle([correct.fullPunjabi, ...distractors]),
      englishGloss: correct.englishGloss,
      tenseLabel,
      pronounDisplay: pronoun,
      verbRoot: verb.root,
      english: verb.english,
    };
  }

  const correctVerbWord = getVerbWord(correct);
  const distractors = generateVerbWordDistractors(verb, tenseId, person, gender, correct, 3);
  if (distractors.length < 3) return null;

  const options = shuffle([correctVerbWord, ...distractors]);

  return {
    format,
    verb,
    tenseId,
    tenseGroup: tenseMeta!.group,
    person,
    gender,
    correctAnswer: correctVerbWord,
    options,
    englishGloss: correct.englishGloss,
    tenseLabel,
    pronounDisplay: pronoun,
    verbRoot: verb.root,
    english: verb.english,
    gapSentence: format === "B" ? buildGapSentence(correct) : undefined,
  };
}

export function buildChallengeRound(
  verbs: Verb[],
  availableTenses: TenseId[]
): ChallengeQuestion[] {
  if (!verbs.length || !availableTenses.length) return [];

  const canUseFormatC = availableTenses.length >= 2;
  const formatSequence = buildFormatSequence(canUseFormatC);
  const questions: ChallengeQuestion[] = [];

  for (let attempt = 0; attempt < CHALLENGE_ROUND_LENGTH * 20 && questions.length < CHALLENGE_ROUND_LENGTH; attempt += 1) {
    let format = formatSequence[questions.length];
    const params = sampleQuestionParams(verbs, availableTenses);
    let question = buildQuestion(
      format,
      params.verb,
      params.tenseId,
      params.person,
      params.gender,
      availableTenses
    );

    if (!question && format === "C") {
      format = Math.random() > 0.5 ? "A" : "B";
      question = buildQuestion(
        format,
        params.verb,
        params.tenseId,
        params.person,
        params.gender,
        availableTenses
      );
    }

    if (question) {
      questions.push(question);
    }
  }

  return questions;
}

export type GroupBreakdown = Record<TenseGroup, { correct: number; total: number }>;

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
