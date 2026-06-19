import { conjugate } from "./conjugate";
import type { ConjugationResult, Gender, Person, RootClass, TenseId, Verb } from "./types";
import { TENSE_CATALOG } from "./types";

const ROOT_CLASSES: RootClass[] = ["consonant", "kanaa", "vowel"];

const SINGULAR_PERSONS: Person[] = ["I", "you", "he_she"];
const PLURAL_PERSONS: Person[] = ["we", "you_plural", "they"];

export function getVerbWord(result: ConjugationResult): string {
  return result.root + result.ending;
}

export function formatTenseLabel(tenseId: TenseId): string {
  const meta = TENSE_CATALOG.find((tense) => tense.id === tenseId);
  if (!meta) return tenseId;
  const groupLabel = meta.group.charAt(0).toUpperCase() + meta.group.slice(1);
  return `${groupLabel} — ${meta.shortLabel}`;
}

function otherRootClasses(rootClass: RootClass): RootClass[] {
  return ROOT_CLASSES.filter((value) => value !== rootClass);
}

export function swapNumberPerson(person: Person): Person {
  if (person === "I") return "we";
  if (person === "you") return "you_plural";
  if (person === "he_she") return "they";
  if (person === "we") return "I";
  if (person === "you_plural") return "you";
  return "he_she";
}

function flipGender(gender: Gender): Gender {
  return gender === "masculine" ? "feminine" : "masculine";
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

type DistractorParams = {
  verb: Verb;
  tenseId: TenseId;
  person: Person;
  gender: Gender;
};

function verbWordFromParams({ verb, tenseId, person, gender }: DistractorParams): string {
  return getVerbWord(conjugate(verb, tenseId, person, gender));
}

/**
 * Generate wrong verb-word options for the same verb and tense by varying
 * gender, number, or root-class ending rules.
 */
export function generateVerbWordDistractors(
  verb: Verb,
  tenseId: TenseId,
  person: Person,
  gender: Gender,
  correct: ConjugationResult,
  count = 3
): string[] {
  const correctWord = getVerbWord(correct);
  const found = new Set<string>();

  const candidates: string[] = [];

  const addCandidate = (params: DistractorParams) => {
    candidates.push(verbWordFromParams(params));
  };

  addCandidate({ verb, tenseId, person, gender: flipGender(gender) });
  addCandidate({ verb, tenseId, person: swapNumberPerson(person), gender });

  for (const rootClass of otherRootClasses(verb.rootClass)) {
    addCandidate({ verb: { ...verb, rootClass }, tenseId, person, gender });
  }

  for (const altPerson of [...SINGULAR_PERSONS, ...PLURAL_PERSONS]) {
    if (altPerson === person) continue;
    addCandidate({ verb, tenseId, person: altPerson, gender });
    addCandidate({ verb, tenseId, person: altPerson, gender: flipGender(gender) });
  }

  for (const altPerson of shuffle([...SINGULAR_PERSONS, ...PLURAL_PERSONS])) {
    for (const rootClass of otherRootClasses(verb.rootClass)) {
      addCandidate({
        verb: { ...verb, rootClass },
        tenseId,
        person: altPerson,
        gender: flipGender(gender),
      });
    }
  }

  for (const candidate of shuffle(candidates)) {
    if (candidate && candidate !== correctWord && !found.has(candidate)) {
      found.add(candidate);
      if (found.size >= count) break;
    }
  }

  return [...found].slice(0, count);
}

/**
 * Full-sentence distractors for Format C: same verb and pronoun, different tenses.
 */
export function generateSentenceDistractors(
  verb: Verb,
  correctTenseId: TenseId,
  person: Person,
  gender: Gender,
  availableTenses: TenseId[],
  count = 3
): string[] {
  const correct = conjugate(verb, correctTenseId, person, gender).fullPunjabi;
  const found = new Set<string>();

  for (const tenseId of shuffle(availableTenses)) {
    if (tenseId === correctTenseId) continue;
    const sentence = conjugate(verb, tenseId, person, gender).fullPunjabi;
    if (sentence !== correct) {
      found.add(sentence);
    }
    if (found.size >= count) break;
  }

  if (found.size < count) {
    for (const tenseId of shuffle(availableTenses)) {
      const sentence = conjugate(verb, tenseId, person, flipGender(gender)).fullPunjabi;
      if (sentence !== correct && !found.has(sentence)) {
        found.add(sentence);
      }
      if (found.size >= count) break;
    }
  }

  return [...found].slice(0, count);
}

export function buildGapSentence(result: ConjugationResult): string {
  const parts = [result.pronoun, "___"];
  if (result.auxiliary) {
    parts.push(result.auxiliary);
  }
  return parts.join(" ");
}
