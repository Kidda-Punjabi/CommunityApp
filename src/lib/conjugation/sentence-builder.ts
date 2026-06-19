import { conjugate } from "./conjugate";
import { getVerbWord } from "./distractors";
import {
  NECESSITY_PRESENT_AUX,
  OBLIQUE_PRONOUNS,
  PAST_AUX,
  PRESENT_AUX,
} from "./pronouns";
import type { ConjugationResult, Gender, Person, TenseId, Verb } from "./types";

export const SENTENCE_BUILDER_ROUND_LENGTH = 10;

/** Default tenses for sentence-builder v1 curriculum focus (present group). */
export const SENTENCE_BUILDER_DEFAULT_TENSES: TenseId[] = [
  "present_habitual",
  "present_want",
  "present_necessity",
];

export type SentenceNoun = {
  id: string;
  punjabi: string;
  english: string;
  gender: Gender;
  romanised: string | null;
};

export type SentenceVariant = "action" | "thing";

export type SentenceBuilderQuestion = {
  id: string;
  englishPrompt: string;
  correctTiles: string[];
  romanised: string | null;
  tenseId: TenseId;
  verb: Verb;
  object: SentenceNoun | null;
  variant: SentenceVariant;
  person: Person;
  gender: Gender;
};

const CHAHIIDA: Record<Gender, { punjabi: string; romanised: string }> = {
  masculine: { punjabi: "ਚਾਹੀਦਾ", romanised: "chaahidaa" },
  feminine: { punjabi: "ਚਾਹੀਦੀ", romanised: "chaahidee" },
};

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

function personLabel(person: Person): string {
  switch (person) {
    case "I":
      return "I";
    case "you":
      return "you";
    case "he_she":
      return "he/she";
    case "we":
      return "we";
    case "you_plural":
      return "you (plural)";
    case "they":
      return "they";
  }
}

function glossVerb(verb: Verb): string {
  return verb.english.replace(/^to\s+/i, "");
}

function joinRomanised(parts: Array<string | null | undefined>): string | null {
  const filtered = parts.filter((part): part is string => Boolean(part?.trim()));
  return filtered.length > 0 ? filtered.join(" ") : null;
}

function tilesFromConjugation(result: ConjugationResult): string[] {
  const tiles = [result.pronoun];
  tiles.push(result.root + result.ending);
  if (result.auxiliary) {
    tiles.push(result.auxiliary);
  }
  return tiles;
}

function romanisedFromConjugation(result: ConjugationResult): string | null {
  return result.fullRomanised.trim() || null;
}

/**
 * Object gender drives ਚਾਹੀਦਾ/ਚਾਹੀਦੀ endings for thing-based want/necessity only.
 */
export function getObjectAgreementGender(
  tenseId: TenseId,
  hasObject: boolean,
  variant: SentenceVariant,
  objectGender: Gender,
  subjectGender: Gender
): Gender {
  if (!hasObject) return subjectGender;
  if (tenseId === "present_necessity" && variant === "thing") return objectGender;
  if (tenseId === "present_want" && variant === "thing") return objectGender;
  return subjectGender;
}

function buildThingSentence(
  person: Person,
  noun: SentenceNoun,
  variant: "want" | "need"
): { tiles: string[]; english: string; romanised: string | null } {
  const oblique = OBLIQUE_PRONOUNS[person];
  const aux = NECESSITY_PRESENT_AUX[person];
  const ending = CHAHIIDA[noun.gender];
  const label = personLabel(person);

  const english =
    variant === "want"
      ? `${label} want ${noun.english}`
      : `${label} need ${noun.english}`;

  return {
    tiles: [oblique.punjabi, noun.punjabi, ending.punjabi, aux.punjabi],
    english,
    romanised: joinRomanised([
      oblique.romanised,
      noun.romanised,
      ending.romanised,
      aux.romanised,
    ]),
  };
}

function buildActionSentence(
  verb: Verb,
  tenseId: TenseId,
  person: Person,
  gender: Gender
): { tiles: string[]; english: string; romanised: string | null } {
  const result = conjugate(verb, tenseId, person, gender);
  const label = personLabel(person);
  const verbGloss = glossVerb(verb);

  let english = result.englishGloss;
  if (tenseId === "present_habitual") {
    english = `${label} ${verbGloss}`;
  }

  return {
    tiles: tilesFromConjugation(result),
    english,
    romanised: romanisedFromConjugation(result),
  };
}

function buildWithObject(
  verb: Verb,
  tenseId: TenseId,
  person: Person,
  gender: Gender,
  noun: SentenceNoun
): { tiles: string[]; english: string; romanised: string | null } {
  const result = conjugate(verb, tenseId, person, gender);
  const verbWord = result.root + result.ending;
  const label = personLabel(person);

  const tiles = [result.pronoun, noun.punjabi, verbWord];
  if (result.auxiliary) {
    tiles.push(result.auxiliary);
  }

  const verbPartRomanised =
    result.fullRomanised.replace(new RegExp(`^${result.pronounRomanised}\\s*`), "").trim() ||
    null;

  return {
    tiles,
    english: `${label} ${glossVerb(verb)} ${noun.english}`,
    romanised: joinRomanised([result.pronounRomanised, noun.romanised, verbPartRomanised]),
  };
}

export function buildSentenceQuestion(
  verb: Verb,
  tenseId: TenseId,
  person: Person,
  gender: Gender,
  object: SentenceNoun | null
): SentenceBuilderQuestion {
  const hasObject = object !== null;
  let variant: SentenceVariant = "action";
  let built: { tiles: string[]; english: string; romanised: string | null };

  if (hasObject && tenseId === "present_necessity") {
    variant = "thing";
    built = buildThingSentence(person, object, "need");
  } else if (hasObject && tenseId === "present_want") {
    variant = "thing";
    built = buildThingSentence(person, object, "want");
  } else if (hasObject) {
    variant = "action";
    built = buildWithObject(verb, tenseId, person, gender, object);
  } else {
    variant = "action";
    built = buildActionSentence(verb, tenseId, person, gender);
  }

  return {
    id: `${verb.id}-${tenseId}-${person}-${gender}-${object?.id ?? "none"}-${variant}`,
    englishPrompt: built.english,
    correctTiles: built.tiles,
    romanised: built.romanised,
    tenseId,
    verb,
    object,
    variant,
    person,
    gender,
  };
}

function flipGender(gender: Gender): Gender {
  return gender === "masculine" ? "feminine" : "masculine";
}

export function generateDecoyTiles(
  question: SentenceBuilderQuestion,
  verbs: Verb[],
  nouns: SentenceNoun[],
  targetCount = 2
): string[] {
  const correct = new Set(question.correctTiles);
  const decoys = new Set<string>();

  const tryAdd = (word: string) => {
    if (word && !correct.has(word) && !decoys.has(word)) {
      decoys.add(word);
    }
  };

  const hasChahida = question.correctTiles.some((tile) => tile === "ਚਾਹੀਦਾ" || tile === "ਚਾਹੀਦੀ");
  if (hasChahida) {
    tryAdd(question.correctTiles.includes("ਚਾਹੀਦਾ") ? "ਚਾਹੀਦੀ" : "ਚਾਹੀਦਾ");
  }

  const auxiliaries = [
    ...Object.values(PRESENT_AUX).map((value) => value.punjabi),
    ...Object.values(NECESSITY_PRESENT_AUX).map((value) => value.punjabi),
    ...Object.values(PAST_AUX).map((value) => value.punjabi),
    "ਹੋ",
  ];
  for (const aux of shuffle(auxiliaries)) {
    if (decoys.size >= targetCount) break;
    tryAdd(aux);
  }

  for (const noun of shuffle(nouns)) {
    if (decoys.size >= targetCount) break;
    if (question.object?.id === noun.id) continue;
    tryAdd(noun.punjabi);
  }

  for (const otherVerb of shuffle(verbs)) {
    if (decoys.size >= targetCount) break;
    if (otherVerb.id === question.verb.id) continue;
    const wrong = conjugate(
      otherVerb,
      question.tenseId,
      question.person,
      flipGender(question.gender)
    );
    tryAdd(getVerbWord(wrong));
    if (wrong.auxiliary) tryAdd(wrong.auxiliary);
  }

  if (question.variant === "action" && question.tenseId !== "present_necessity") {
    const wrongGender = conjugate(
      question.verb,
      question.tenseId,
      question.person,
      flipGender(question.gender)
    );
    tryAdd(wrongGender.root + wrongGender.ending);
  }

  return [...decoys].slice(0, targetCount);
}

export type SentenceTile = {
  id: string;
  word: string;
};

export function buildTileBank(question: SentenceBuilderQuestion, verbs: Verb[], nouns: SentenceNoun[]): SentenceTile[] {
  const decoyCount = Math.random() > 0.5 ? 2 : 1;
  const decoys = generateDecoyTiles(question, verbs, nouns, decoyCount);
  const words = shuffle([...question.correctTiles, ...decoys]);

  return words.map((word, index) => ({
    id: `${question.id}-${word}-${index}`,
    word,
  }));
}

export function buildSentenceRound(
  verbs: Verb[],
  nouns: SentenceNoun[],
  availableTenses: TenseId[]
): SentenceBuilderQuestion[] {
  if (!verbs.length || !availableTenses.length) return [];

  const questions: SentenceBuilderQuestion[] = [];

  for (let i = 0; i < SENTENCE_BUILDER_ROUND_LENGTH; i += 1) {
    const verb = pickRandom(verbs);
    const tenseId = pickRandom(availableTenses);
    const person = pickRandom(ALL_PERSONS);
    const gender = pickRandom(ALL_GENDERS);
    const includeObject = nouns.length > 0 && Math.random() < 0.5;
    const object = includeObject ? pickRandom(nouns) : null;

    questions.push(buildSentenceQuestion(verb, tenseId, person, gender, object));
  }

  return questions;
}

export function answersMatch(built: string[], correct: string[]): boolean {
  if (built.length !== correct.length) return false;
  return built.every((word, index) => word === correct[index]);
}
