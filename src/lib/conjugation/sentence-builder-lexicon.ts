import { conjugate } from "./conjugate";
import { getVerbWord } from "./distractors";
import {
  getVerbWordRomanised,
  romanisedTilesFromConjugationResult,
  tilesFromConjugationResult,
} from "./format";
import {
  ABILITY_ENDINGS,
  CONTINUOUS_ENDINGS,
  FUTURE_ABILITY_FUSED,
  FUTURE_ABILITY_CONSONANT_YOU,
  FUTURE_ABILITY_HE_SHE,
  FUTURE_NECESSITY_FUSED,
  FUTURE_PERFECT_AUX,
  FUTURE_SIMPLE_FUSED,
  FUTURE_SIMPLE_CONSONANT_YOU,
  FUTURE_SIMPLE_HE_SHE,
  HABITUAL_CONSONANT,
  HABITUAL_KANAA,
  HABITUAL_VOWEL,
  NECESSITY_PRESENT_AUX,
  NECESSITY_PRESENT_ENDINGS,
  OBLIQUE_PRONOUNS,
  PAST_AUX,
  PAST_NECESSITY_ENDINGS,
  PAST_SIMPLE_CONSONANT,
  PAST_SIMPLE_KANAA,
  PAST_SIMPLE_VOWEL,
  PERFECT_PARTICIPLE,
  PRESENT_AUX,
  SUBJECT_PRONOUNS,
  WANT_ENDINGS,
} from "./pronouns";
import { enrichVerbRomanisation, latinRomanised } from "./romanised";
import type { SentenceNoun } from "./load-gendered-nouns";
import { GAME_PERSON_POOL, TENSE_CATALOG, type Gender, type Person, type TenseId, type Verb } from "./types";

const ALL_PERSONS: Person[] = GAME_PERSON_POOL;
const ALL_GENDERS: Gender[] = ["masculine", "feminine"];

const ENDING_TABLES = [
  HABITUAL_CONSONANT,
  HABITUAL_KANAA,
  HABITUAL_VOWEL,
  CONTINUOUS_ENDINGS,
  ABILITY_ENDINGS,
  WANT_ENDINGS,
  NECESSITY_PRESENT_ENDINGS,
  PAST_SIMPLE_CONSONANT,
  PAST_SIMPLE_KANAA,
  PAST_SIMPLE_VOWEL,
  PERFECT_PARTICIPLE,
  PAST_NECESSITY_ENDINGS,
  FUTURE_SIMPLE_FUSED,
  FUTURE_SIMPLE_CONSONANT_YOU,
  FUTURE_SIMPLE_HE_SHE,
  FUTURE_PERFECT_AUX,
  FUTURE_ABILITY_FUSED,
  FUTURE_ABILITY_CONSONANT_YOU,
  FUTURE_ABILITY_HE_SHE,
  FUTURE_NECESSITY_FUSED,
];

function addToLexicon(
  map: Map<string, string>,
  punjabi: string,
  romanised: string | null | undefined
) {
  const latin = latinRomanised(romanised);
  if (punjabi && latin) {
    map.set(punjabi, latin);
  }
}

export function buildSentenceRomanisationLexicon(
  verbs: Verb[],
  nouns: SentenceNoun[]
): Map<string, string> {
  const map = new Map<string, string>();

  for (const set of [
    SUBJECT_PRONOUNS,
    OBLIQUE_PRONOUNS,
    PRESENT_AUX,
    PAST_AUX,
    NECESSITY_PRESENT_AUX,
  ]) {
    for (const entry of Object.values(set)) {
      addToLexicon(map, entry.punjabi, entry.romanised);
    }
  }

  addToLexicon(map, "ਚਾਹੀਦਾ", "chaahidaa");
  addToLexicon(map, "ਚਾਹੀਦੀ", "chaahidee");
  addToLexicon(map, "ਹੋ", "ho");

  for (const table of ENDING_TABLES) {
    for (const entry of Object.values(table)) {
      addToLexicon(map, entry.punjabi, entry.romanised);
    }
  }

  for (const noun of nouns) {
    addToLexicon(map, noun.punjabi, noun.romanised);
  }

  const enrichedVerbs = verbs.map(enrichVerbRomanisation);

  for (const verb of enrichedVerbs) {
    addToLexicon(map, verb.infinitive, verb.infinitiveRomanised);
    addToLexicon(map, verb.root, verb.rootRomanised);

    for (const { id: tenseId } of TENSE_CATALOG) {
      for (const person of ALL_PERSONS) {
        for (const gender of ALL_GENDERS) {
          const result = conjugate(verb, tenseId as TenseId, person, gender);
          const punjabiTiles = tilesFromConjugationResult(result);
          const romTiles = romanisedTilesFromConjugationResult(result);
          punjabiTiles.forEach((punjabi, index) => {
            addToLexicon(map, punjabi, romTiles[index]);
          });

          const fused = getVerbWord(result);
          addToLexicon(map, fused, getVerbWordRomanised(result));

          if (result.auxiliary) {
            addToLexicon(map, result.auxiliary, result.auxiliaryRomanised);
          }
          addToLexicon(map, result.pronoun, result.pronounRomanised);
        }
      }
    }
  }

  return map;
}

let cachedLexicon: {
  verbs: Verb[];
  nouns: SentenceNoun[];
  map: Map<string, string>;
} | null = null;

export function getSentenceRomanisationLexicon(
  verbs: Verb[],
  nouns: SentenceNoun[]
): Map<string, string> {
  if (cachedLexicon && cachedLexicon.verbs === verbs && cachedLexicon.nouns === nouns) {
    return cachedLexicon.map;
  }
  const map = buildSentenceRomanisationLexicon(verbs, nouns);
  cachedLexicon = { verbs, nouns, map };
  return map;
}

export function lookupRomanised(lexicon: Map<string, string>, punjabi: string): string {
  return lexicon.get(punjabi) ?? "";
}
