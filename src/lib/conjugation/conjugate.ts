import {
  ABILITY_ENDINGS,
  CONTINUOUS_ENDINGS,
  FUTURE_ABILITY_FUSED,
  FUTURE_ABILITY_HE_SHE,
  FUTURE_NECESSITY_FUSED,
  FUTURE_PERFECT_AUX,
  FUTURE_SIMPLE_FUSED,
  FUTURE_SIMPLE_HE_SHE,
  HABITUAL_CONSONANT,
  HABITUAL_KANAA,
  HABITUAL_VOWEL,
  NECESSITY_PRESENT_AUX,
  NECESSITY_PRESENT_ENDINGS,
  OBLIQUE_PRONOUNS,
  PAST_AUX,
  PAST_NECESSITY_ENDINGS,
  PAST_SIMPLE_REGULAR,
  PERFECT_PARTICIPLE,
  PRESENT_AUX,
  SUBJECT_PRONOUNS,
  WANT_ENDINGS,
  getAgreementSlot,
  pickEnding,
} from "./pronouns";
import type {
  AgreementSlot,
  ConjugationResult,
  Gender,
  Person,
  RootClass,
  TenseId,
  Verb,
} from "./types";

type BuildParams = {
  pronoun: string;
  pronounRomanised: string;
  verbStem: string;
  verbStemRomanised: string;
  ending: string;
  endingRomanised: string;
  auxiliary: string | null;
  auxiliaryRomanised: string | null;
  englishGloss: string;
  explanation: string;
};

const HABITUAL_PRESENT_STEMS: Record<string, { stem: string; romanised: string; note: string }> = {
  "ਹੋਣਾ": { stem: "ਹੁ", romanised: "hu", note: "ਹੋਣਾ uses ਹੁੰਦਾ in present habitual" },
  "ਦੇਣਾ": { stem: "ਦਿ", romanised: "di", note: "ਦੇਣਾ uses ਦਿੰਦਾ in present habitual (irregular)" },
};

function buildResult(params: BuildParams): ConjugationResult {
  const verbWord = params.verbStem + params.ending;
  const verbWordRomanised = params.verbStemRomanised + params.endingRomanised;

  const punjabiParts = [params.pronoun, verbWord];
  const romanisedParts = [params.pronounRomanised, verbWordRomanised];

  if (params.auxiliary) {
    punjabiParts.push(params.auxiliary);
    romanisedParts.push(params.auxiliaryRomanised!);
  }

  return {
    pronoun: params.pronoun,
    pronounRomanised: params.pronounRomanised,
    root: params.verbStem,
    ending: params.ending,
    endingRomanised: params.endingRomanised,
    auxiliary: params.auxiliary,
    auxiliaryRomanised: params.auxiliaryRomanised,
    fullPunjabi: punjabiParts.join(" "),
    fullRomanised: romanisedParts.join(" "),
    englishGloss: params.englishGloss,
    explanation: params.explanation,
  };
}

function habitualEndingTable(rootClass: RootClass) {
  switch (rootClass) {
    case "kanaa":
      return HABITUAL_KANAA;
    case "vowel":
      return HABITUAL_VOWEL;
    default:
      return HABITUAL_CONSONANT;
  }
}

function getHabitualStem(
  verb: Verb,
  tenseLabel: string
): { stem: string; romanised: string; explanation: string } {
  const override = HABITUAL_PRESENT_STEMS[verb.infinitive];
  if (override) {
    return {
      stem: override.stem,
      romanised: override.romanised,
      explanation: override.note,
    };
  }

  let stem = verb.root;
  let romanised = verb.rootRomanised ?? verb.root;
  let explanation = `${tenseLabel}: ${verb.rootClass} root + habitual ending`;

  if (verb.hasTippiInsertion) {
    stem = verb.root + "ੰ";
    romanised = (verb.rootRomanised ?? verb.root) + "n";
    explanation = `${tenseLabel}: tippi insertion (ੰ) before habitual ending`;
  }

  return { stem, romanised, explanation };
}

function getIrregularPastStem(verb: Verb, slot: AgreementSlot): string | null {
  switch (slot) {
    case "masc_sg":
      return verb.irregularPastMascSg;
    case "fem_sg":
      return verb.irregularPastFemSg;
    case "masc_pl":
      return verb.irregularPastMascPl;
    case "fem_pl":
      return verb.irregularPastFemPl;
    default:
      return null;
  }
}

function englishPersonLabel(person: Person): string {
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

function futureSimpleEnding(person: Person, slot: AgreementSlot) {
  if (person === "he_she" || person === "we" || person === "you_plural" || person === "they") {
    return pickEnding(FUTURE_SIMPLE_HE_SHE, slot);
  }
  return pickEnding(FUTURE_SIMPLE_FUSED, slot);
}

function futureAbilityEnding(person: Person, slot: AgreementSlot) {
  if (person === "he_she" || person === "we" || person === "you_plural" || person === "they") {
    return pickEnding(FUTURE_ABILITY_HE_SHE, slot);
  }
  return pickEnding(FUTURE_ABILITY_FUSED, slot);
}

function glossVerb(verb: Verb): string {
  return verb.english.replace(/^to\s+/i, "");
}

export function conjugate(
  verb: Verb,
  tenseId: TenseId,
  person: Person,
  gender: Gender
): ConjugationResult {
  const slot = getAgreementSlot(person, gender);
  const subject = SUBJECT_PRONOUNS[person];
  const oblique = OBLIQUE_PRONOUNS[person];
  const personLabel = englishPersonLabel(person);
  const verbGloss = glossVerb(verb);

  switch (tenseId) {
    case "present_habitual": {
      const { stem, romanised, explanation } = getHabitualStem(verb, "Present habitual");
      const ending = pickEnding(habitualEndingTable(verb.rootClass), slot);
      const aux = PRESENT_AUX[person];
      return buildResult({
        pronoun: subject.punjabi,
        pronounRomanised: subject.romanised,
        verbStem: stem,
        verbStemRomanised: romanised,
        ending: ending.punjabi,
        endingRomanised: ending.romanised,
        auxiliary: aux.punjabi,
        auxiliaryRomanised: aux.romanised,
        englishGloss: `${personLabel} ${verbGloss}`,
        explanation,
      });
    }

    case "present_continuous": {
      const ending = pickEnding(CONTINUOUS_ENDINGS, slot);
      const aux = PRESENT_AUX[person];
      return buildResult({
        pronoun: subject.punjabi,
        pronounRomanised: subject.romanised,
        verbStem: verb.root,
        verbStemRomanised: verb.rootRomanised ?? verb.root,
        ending: ending.punjabi,
        endingRomanised: ending.romanised,
        auxiliary: aux.punjabi,
        auxiliaryRomanised: aux.romanised,
        englishGloss: `${personLabel} ${verbGloss} (right now)`,
        explanation: "Present continuous: root + ਰਿਹਾ/ਰਹੀ family + present auxiliary",
      });
    }

    case "present_ability": {
      const ending = pickEnding(ABILITY_ENDINGS, slot);
      const aux = PRESENT_AUX[person];
      return buildResult({
        pronoun: subject.punjabi,
        pronounRomanised: subject.romanised,
        verbStem: verb.root,
        verbStemRomanised: verb.rootRomanised ?? verb.root,
        ending: ending.punjabi,
        endingRomanised: ending.romanised,
        auxiliary: aux.punjabi,
        auxiliaryRomanised: aux.romanised,
        englishGloss: `${personLabel} can ${verbGloss}`,
        explanation: "Present ability: root + ਸਕਦਾ/ਸਕਦੀ family + present auxiliary",
      });
    }

    case "present_want": {
      const ending = pickEnding(WANT_ENDINGS, slot);
      const aux = PRESENT_AUX[person];
      return buildResult({
        pronoun: subject.punjabi,
        pronounRomanised: subject.romanised,
        verbStem: verb.infinitive,
        verbStemRomanised: verb.infinitiveRomanised ?? verb.infinitive,
        ending: ending.punjabi,
        endingRomanised: ending.romanised,
        auxiliary: aux.punjabi,
        auxiliaryRomanised: aux.romanised,
        englishGloss: `${personLabel} want to ${verbGloss}`,
        explanation: "Present want: full infinitive + ਚਾਹੁੰਦਾ family + present auxiliary",
      });
    }

    case "present_necessity": {
      const ending = pickEnding(NECESSITY_PRESENT_ENDINGS, slot);
      const aux = NECESSITY_PRESENT_AUX[person];
      return buildResult({
        pronoun: oblique.punjabi,
        pronounRomanised: oblique.romanised,
        verbStem: verb.infinitive,
        verbStemRomanised: verb.infinitiveRomanised ?? verb.infinitive,
        ending: ending.punjabi,
        endingRomanised: ending.romanised,
        auxiliary: aux.punjabi,
        auxiliaryRomanised: aux.romanised,
        englishGloss: `${personLabel} have to ${verbGloss}`,
        explanation:
          "Present necessity: oblique pronoun + infinitive + ਪੈਂਦਾ family + ਹੈ/ਹਨ — TODO: verify gender agreement",
      });
    }

    case "past_simple": {
      const aux = PAST_AUX[person];
      if (verb.isIrregular && getIrregularPastStem(verb, slot)) {
        const stem = getIrregularPastStem(verb, slot)!;
        return buildResult({
          pronoun: subject.punjabi,
          pronounRomanised: subject.romanised,
          verbStem: stem,
          verbStemRomanised: stem,
          ending: "",
          endingRomanised: "",
          auxiliary: aux.punjabi,
          auxiliaryRomanised: aux.romanised,
          englishGloss: `${personLabel} ${verbGloss} (past)`,
          explanation: "Simple past: irregular past stem override + ਸੀ/ਸਨ",
        });
      }
      const ending = pickEnding(PAST_SIMPLE_REGULAR, slot);
      return buildResult({
        pronoun: subject.punjabi,
        pronounRomanised: subject.romanised,
        verbStem: verb.root,
        verbStemRomanised: verb.rootRomanised ?? verb.root,
        ending: ending.punjabi,
        endingRomanised: ending.romanised,
        auxiliary: aux.punjabi,
        auxiliaryRomanised: aux.romanised,
        englishGloss: `${personLabel} ${verbGloss} (past)`,
        explanation: "Simple past: regular root + ਆ/ਈ/ਏ/ਈਆਂ + ਸੀ/ਸਨ",
      });
    }

    case "past_perfect": {
      const aux = PAST_AUX[person];
      const participle = pickEnding(PERFECT_PARTICIPLE, slot);
      return buildResult({
        pronoun: subject.punjabi,
        pronounRomanised: subject.romanised,
        verbStem: verb.root,
        verbStemRomanised: verb.rootRomanised ?? verb.root,
        ending: participle.punjabi,
        endingRomanised: participle.romanised,
        auxiliary: aux.punjabi,
        auxiliaryRomanised: aux.romanised,
        englishGloss: `${personLabel} had ${verbGloss}ed`,
        explanation: "Past perfect: root + ਚੁੱਕਾ participle + ਸੀ/ਸਨ",
      });
    }

    case "past_habitual": {
      const { stem, romanised, explanation } = getHabitualStem(verb, "Past habitual");
      const ending = pickEnding(habitualEndingTable(verb.rootClass), slot);
      const aux = PAST_AUX[person];
      return buildResult({
        pronoun: subject.punjabi,
        pronounRomanised: subject.romanised,
        verbStem: stem,
        verbStemRomanised: romanised,
        ending: ending.punjabi,
        endingRomanised: ending.romanised,
        auxiliary: aux.punjabi,
        auxiliaryRomanised: aux.romanised,
        englishGloss: `${personLabel} used to ${verbGloss}`,
        explanation: explanation.replace("Present habitual", "Past habitual") + " + past auxiliary",
      });
    }

    case "past_continuous": {
      const ending = pickEnding(CONTINUOUS_ENDINGS, slot);
      const aux = PAST_AUX[person];
      return buildResult({
        pronoun: subject.punjabi,
        pronounRomanised: subject.romanised,
        verbStem: verb.root,
        verbStemRomanised: verb.rootRomanised ?? verb.root,
        ending: ending.punjabi,
        endingRomanised: ending.romanised,
        auxiliary: aux.punjabi,
        auxiliaryRomanised: aux.romanised,
        englishGloss: `${personLabel} was ${verbGloss}ing`,
        explanation: "Past continuous: root + ਰਿਹਾ/ਰਹੀ family + ਸੀ/ਸਨ",
      });
    }

    case "past_ability": {
      const ending = pickEnding(ABILITY_ENDINGS, slot);
      const aux = PAST_AUX[person];
      return buildResult({
        pronoun: subject.punjabi,
        pronounRomanised: subject.romanised,
        verbStem: verb.root,
        verbStemRomanised: verb.rootRomanised ?? verb.root,
        ending: ending.punjabi,
        endingRomanised: ending.romanised,
        auxiliary: aux.punjabi,
        auxiliaryRomanised: aux.romanised,
        englishGloss: `${personLabel} could ${verbGloss}`,
        explanation: "Past ability: root + ਸਕਦਾ family + ਸੀ/ਸਨ",
      });
    }

    case "past_necessity": {
      const ending = pickEnding(PAST_NECESSITY_ENDINGS, slot);
      const aux = PAST_AUX[person];
      return buildResult({
        pronoun: oblique.punjabi,
        pronounRomanised: oblique.romanised,
        verbStem: verb.infinitive,
        verbStemRomanised: verb.infinitiveRomanised ?? verb.infinitive,
        ending: ending.punjabi,
        endingRomanised: ending.romanised,
        auxiliary: aux.punjabi,
        auxiliaryRomanised: aux.romanised,
        englishGloss: `${personLabel} had to ${verbGloss}`,
        explanation:
          "Past necessity (situational): oblique + infinitive + ਪਿਆ family + ਸੀ/ਸਨ — habitual form not yet built",
      });
    }

    case "future_simple": {
      const ending = futureSimpleEnding(person, slot);
      return buildResult({
        pronoun: subject.punjabi,
        pronounRomanised: subject.romanised,
        verbStem: verb.root,
        verbStemRomanised: verb.rootRomanised ?? verb.root,
        ending: ending.punjabi,
        endingRomanised: ending.romanised,
        auxiliary: null,
        auxiliaryRomanised: null,
        englishGloss: `${personLabel} will ${verbGloss}`,
        explanation: "Future simple: root + fused future ending (no separate auxiliary)",
      });
    }

    case "future_perfect": {
      const participle = pickEnding(PERFECT_PARTICIPLE, slot);
      const aux = pickEnding(FUTURE_PERFECT_AUX, slot);
      return buildResult({
        pronoun: subject.punjabi,
        pronounRomanised: subject.romanised,
        verbStem: verb.root,
        verbStemRomanised: verb.rootRomanised ?? verb.root,
        ending: participle.punjabi,
        endingRomanised: participle.romanised,
        auxiliary: aux.punjabi,
        auxiliaryRomanised: aux.romanised,
        englishGloss: `${personLabel} will have ${verbGloss}ed`,
        explanation: "Future perfect: root + ਚੁੱਕਾ participle + ਹੋਵੇਗਾ auxiliary",
      });
    }

    case "future_ability": {
      const ending = futureAbilityEnding(person, slot);
      return buildResult({
        pronoun: subject.punjabi,
        pronounRomanised: subject.romanised,
        verbStem: verb.root,
        verbStemRomanised: verb.rootRomanised ?? verb.root,
        ending: ending.punjabi,
        endingRomanised: ending.romanised,
        auxiliary: null,
        auxiliaryRomanised: null,
        englishGloss: `${personLabel} will be able to ${verbGloss}`,
        explanation: "Future ability: root + fused ਸਕਾਂਗਾ/ਸਕੇਗਾ ending",
      });
    }

    case "future_necessity": {
      const ending = pickEnding(FUTURE_NECESSITY_FUSED, slot);
      return buildResult({
        pronoun: oblique.punjabi,
        pronounRomanised: oblique.romanised,
        verbStem: verb.infinitive,
        verbStemRomanised: verb.infinitiveRomanised ?? verb.infinitive,
        ending: ending.punjabi,
        endingRomanised: ending.romanised,
        auxiliary: null,
        auxiliaryRomanised: null,
        englishGloss: `${personLabel} will have to ${verbGloss}`,
        explanation: "Future necessity: oblique + infinitive + fused ਪਵੇਗਾ ending",
      });
    }

    default: {
      const _exhaustive: never = tenseId;
      throw new Error(`Unknown tense: ${_exhaustive}`);
    }
  }
}

export function searchVerbs(verbs: Verb[], query: string): Verb[] {
  const term = query.trim().toLowerCase();
  if (!term) return verbs;

  return verbs.filter((verb) => {
    if (verb.infinitive.toLowerCase().includes(term)) return true;
    if (verb.english.toLowerCase().includes(term)) return true;
    if (verb.root.toLowerCase().includes(term)) return true;
    if (verb.infinitiveRomanised?.toLowerCase().includes(term)) return true;
    if (verb.rootRomanised?.toLowerCase().includes(term)) return true;
    return false;
  });
}
