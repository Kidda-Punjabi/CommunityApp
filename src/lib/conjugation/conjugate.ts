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
  VerbWordLayout,
} from "./types";
import { englishPersonLabel, glossVerb, verbWordDisplay, verbWordLayoutForTense } from "./format";
import {
  latinRomanised,
  resolveEndingRomanised,
  resolvePronounRomanised,
  resolveStemRomanised,
} from "./romanised";

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
  verbWordLayout: VerbWordLayout;
};

function startsWithVowelSound(endingPunjabi: string): boolean {
  return /^[ਾਿੀੁੂੇੈੋੌਅਆਇਈਉਊਏਐਓਔ]/.test(endingPunjabi);
}

function applyVowelGlide(
  verb: Verb,
  stemPunjabi: string,
  stemRomanised: string,
  endingPunjabi: string,
  endingRomanised: string
): {
  stemPunjabi: string;
  stemRomanised: string;
  endingPunjabi: string;
  endingRomanised: string;
} {
  if (
    (verb.rootClass !== "vowel" && verb.rootClass !== "kanaa") ||
    !startsWithVowelSound(endingPunjabi) ||
    stemPunjabi.endsWith("ਵ")
  ) {
    return { stemPunjabi, stemRomanised, endingPunjabi, endingRomanised };
  }

  let nextEndingPunjabi = endingPunjabi;
  if (endingPunjabi.startsWith("ਏ")) {
    nextEndingPunjabi = `ੇ${endingPunjabi.slice(1)}`;
  }

  const nextStemRomanised = stemRomanised ? `${stemRomanised}v` : stemRomanised;
  return {
    stemPunjabi: `${stemPunjabi}ਵ`,
    stemRomanised: nextStemRomanised,
    endingPunjabi: nextEndingPunjabi,
    endingRomanised,
  };
}

const HABITUAL_PRESENT_STEMS: Record<string, { stem: string; romanised: string; note: string }> = {
  "ਹੋਣਾ": { stem: "ਹੁ", romanised: "hu", note: "ਹੋਣਾ uses ਹੁੰਦਾ in present habitual" },
  "ਦੇਣਾ": { stem: "ਦਿ", romanised: "di", note: "ਦੇਣਾ uses ਦਿੰਦਾ in present habitual (irregular)" },
};

function buildResult(params: BuildParams): ConjugationResult {
  const stemRomanised = latinRomanised(params.verbStemRomanised) ?? "";
  const endingRomanised = resolveEndingRomanised(params.ending, params.endingRomanised);
  const pronounRomanised = resolvePronounRomanised(params.pronounRomanised);
  const auxiliaryRomanised = params.auxiliaryRomanised
    ? resolvePronounRomanised(params.auxiliaryRomanised)
    : null;

  const verbWord = verbWordDisplay(params.verbStem, params.ending, params.verbWordLayout);
  const verbWordRomanised = verbWordDisplay(
    stemRomanised,
    endingRomanised,
    params.verbWordLayout
  );

  const punjabiParts = [params.pronoun, verbWord];
  const romanisedParts = [pronounRomanised, verbWordRomanised];

  if (params.auxiliary) {
    punjabiParts.push(params.auxiliary);
    romanisedParts.push(auxiliaryRomanised!);
  }

  return {
    pronoun: params.pronoun,
    pronounRomanised,
    root: params.verbStem,
    stemRomanised,
    ending: params.ending,
    endingRomanised,
    verbWordLayout: params.verbWordLayout,
    auxiliary: params.auxiliary,
    auxiliaryRomanised,
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

function pastSimpleEndingTable(rootClass: RootClass) {
  switch (rootClass) {
    case "kanaa":
      return PAST_SIMPLE_KANAA;
    case "vowel":
      return PAST_SIMPLE_VOWEL;
    default:
      return PAST_SIMPLE_CONSONANT;
  }
}

function pastSimpleExplanation(rootClass: RootClass): string {
  switch (rootClass) {
    case "kanaa":
      return "Simple past (kanaa root): root + ਆ/ਈ/ਏ/ਈਆਂ + ਸੀ/ਸਨ";
    case "vowel":
      return "Simple past (vowel root): root + ਆ/ਈ/ਏ/ਈਆਂ + ਸੀ/ਸਨ";
    default:
      return "Simple past (consonant root): root + ਿਆ/ੀ/ੇ/ੀਆਂ fused to final consonant + ਸੀ/ਸਨ";
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
  let romanised = resolveStemRomanised(verb, stem);
  let explanation = `${tenseLabel}: ${verb.rootClass} root + habitual ending`;

  if (verb.hasTippiInsertion) {
    stem = verb.root + "ੰ";
    romanised = resolveStemRomanised(verb, stem);
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

function futureSimpleFusedTable(_rootClass: RootClass) {
  return FUTURE_SIMPLE_FUSED;
}

function futureSimpleYouTable(_rootClass: RootClass) {
  return FUTURE_SIMPLE_CONSONANT_YOU;
}

function futureSimpleHeSheTable(_rootClass: RootClass) {
  return FUTURE_SIMPLE_HE_SHE;
}

function futureSimpleEnding(person: Person, slot: AgreementSlot, rootClass: RootClass) {
  if (person === "you_plural" || person === "you") {
    return pickEnding(futureSimpleYouTable(rootClass), slot);
  }
  if (person === "we") {
    return pickEnding(futureSimpleFusedTable(rootClass), slot);
  }
  if (person === "he_she" || person === "they") {
    return pickEnding(futureSimpleHeSheTable(rootClass), slot);
  }
  return pickEnding(futureSimpleFusedTable(rootClass), slot);
}

function futureAbilityEnding(person: Person, slot: AgreementSlot, rootClass: RootClass) {
  if (person === "you_plural" || person === "you") {
    return pickEnding(futureAbilityYouTable(rootClass), slot);
  }
  if (person === "we") {
    return pickEnding(futureAbilityFusedTable(rootClass), slot);
  }
  if (person === "he_she" || person === "they") {
    return pickEnding(futureAbilityHeSheTable(rootClass), slot);
  }
  return pickEnding(futureAbilityFusedTable(rootClass), slot);
}

function futureAbilityFusedTable(_rootClass: RootClass) {
  return FUTURE_ABILITY_FUSED;
}

function futureAbilityHeSheTable(_rootClass: RootClass) {
  return FUTURE_ABILITY_HE_SHE;
}

function futureAbilityYouTable(_rootClass: RootClass) {
  return FUTURE_ABILITY_CONSONANT_YOU;
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
  const personLabel = englishPersonLabel(person, gender);
  const verbGloss = glossVerb(verb.english);
  const layout = verbWordLayoutForTense(tenseId);

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
        verbWordLayout: layout,
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
        verbStemRomanised: resolveStemRomanised(verb, verb.root),
        ending: ending.punjabi,
        endingRomanised: ending.romanised,
        auxiliary: aux.punjabi,
        auxiliaryRomanised: aux.romanised,
        englishGloss: `${personLabel} ${verbGloss} (right now)`,
        verbWordLayout: layout,
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
        verbStemRomanised: resolveStemRomanised(verb, verb.root),
        ending: ending.punjabi,
        endingRomanised: ending.romanised,
        auxiliary: aux.punjabi,
        auxiliaryRomanised: aux.romanised,
        englishGloss: `${personLabel} can ${verbGloss}`,
        verbWordLayout: layout,
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
        verbStemRomanised: resolveStemRomanised(verb, verb.infinitive),
        ending: ending.punjabi,
        endingRomanised: ending.romanised,
        auxiliary: aux.punjabi,
        auxiliaryRomanised: aux.romanised,
        englishGloss: `${personLabel} want to ${verbGloss}`,
        verbWordLayout: layout,
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
        verbStemRomanised: resolveStemRomanised(verb, verb.infinitive),
        ending: ending.punjabi,
        endingRomanised: ending.romanised,
        auxiliary: aux.punjabi,
        auxiliaryRomanised: aux.romanised,
        englishGloss: `${personLabel} have to ${verbGloss}`,
        verbWordLayout: layout,
        explanation: "Present necessity: oblique pronoun + infinitive + paindaa-family + hai/han",
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
          verbStemRomanised: resolveStemRomanised(verb, stem),
          ending: "",
          endingRomanised: "",
          auxiliary: aux.punjabi,
          auxiliaryRomanised: aux.romanised,
          englishGloss: `${personLabel} ${verbGloss} (past)`,
          verbWordLayout: layout,
        explanation: "Simple past: irregular past stem override + ਸੀ/ਸਨ",
        });
      }
      const ending = pickEnding(pastSimpleEndingTable(verb.rootClass), slot);
      return buildResult({
        pronoun: subject.punjabi,
        pronounRomanised: subject.romanised,
        verbStem: verb.root,
        verbStemRomanised: resolveStemRomanised(verb, verb.root),
        ending: ending.punjabi,
        endingRomanised: ending.romanised,
        auxiliary: aux.punjabi,
        auxiliaryRomanised: aux.romanised,
        englishGloss: `${personLabel} ${verbGloss} (past)`,
        verbWordLayout: layout,
        explanation: pastSimpleExplanation(verb.rootClass),
      });
    }

    case "past_perfect": {
      const aux = PAST_AUX[person];
      const participle = pickEnding(PERFECT_PARTICIPLE, slot);
      return buildResult({
        pronoun: subject.punjabi,
        pronounRomanised: subject.romanised,
        verbStem: verb.root,
        verbStemRomanised: resolveStemRomanised(verb, verb.root),
        ending: participle.punjabi,
        endingRomanised: participle.romanised,
        auxiliary: aux.punjabi,
        auxiliaryRomanised: aux.romanised,
        englishGloss: `${personLabel} had ${verbGloss}ed`,
        verbWordLayout: layout,
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
        verbWordLayout: layout,
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
        verbStemRomanised: resolveStemRomanised(verb, verb.root),
        ending: ending.punjabi,
        endingRomanised: ending.romanised,
        auxiliary: aux.punjabi,
        auxiliaryRomanised: aux.romanised,
        englishGloss: `${personLabel} was ${verbGloss}ing`,
        verbWordLayout: layout,
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
        verbStemRomanised: resolveStemRomanised(verb, verb.root),
        ending: ending.punjabi,
        endingRomanised: ending.romanised,
        auxiliary: aux.punjabi,
        auxiliaryRomanised: aux.romanised,
        englishGloss: `${personLabel} could ${verbGloss}`,
        verbWordLayout: layout,
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
        verbStemRomanised: resolveStemRomanised(verb, verb.infinitive),
        ending: ending.punjabi,
        endingRomanised: ending.romanised,
        auxiliary: aux.punjabi,
        auxiliaryRomanised: aux.romanised,
        englishGloss: `${personLabel} had to ${verbGloss}`,
        verbWordLayout: layout,
        explanation: "Past necessity: oblique pronoun + infinitive + piaa-family + see/san",
      });
    }

    case "future_simple": {
      const ending = futureSimpleEnding(person, slot, verb.rootClass);
      const stemRomanised = resolveStemRomanised(verb, verb.root);
      const withGlide = applyVowelGlide(
        verb,
        verb.root,
        stemRomanised,
        ending.punjabi,
        ending.romanised
      );
      return buildResult({
        pronoun: subject.punjabi,
        pronounRomanised: subject.romanised,
        verbStem: withGlide.stemPunjabi,
        verbStemRomanised: withGlide.stemRomanised,
        ending: withGlide.endingPunjabi,
        endingRomanised: withGlide.endingRomanised,
        auxiliary: null,
        auxiliaryRomanised: null,
        englishGloss: `${personLabel} will ${verbGloss}`,
        verbWordLayout: layout,
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
        verbStemRomanised: resolveStemRomanised(verb, verb.root),
        ending: participle.punjabi,
        endingRomanised: participle.romanised,
        auxiliary: aux.punjabi,
        auxiliaryRomanised: aux.romanised,
        englishGloss: `${personLabel} will have ${verbGloss}ed`,
        verbWordLayout: layout,
        explanation: "Future perfect: root + ਚੁੱਕਾ participle + ਹੋਵੇਗਾ auxiliary",
      });
    }

    case "future_ability": {
      const ending = futureAbilityEnding(person, slot, verb.rootClass);
      const stemRomanised = resolveStemRomanised(verb, verb.root);
      const withGlide = applyVowelGlide(
        verb,
        verb.root,
        stemRomanised,
        ending.punjabi,
        ending.romanised
      );
      return buildResult({
        pronoun: subject.punjabi,
        pronounRomanised: subject.romanised,
        verbStem: withGlide.stemPunjabi,
        verbStemRomanised: withGlide.stemRomanised,
        ending: withGlide.endingPunjabi,
        endingRomanised: withGlide.endingRomanised,
        auxiliary: null,
        auxiliaryRomanised: null,
        englishGloss: `${personLabel} will be able to ${verbGloss}`,
        verbWordLayout: layout,
        explanation: "Future ability: root + fused ਸਕਾਂਗਾ/ਸਕੇਗਾ ending",
      });
    }

    case "future_necessity": {
      const ending = pickEnding(FUTURE_NECESSITY_FUSED, slot);
      return buildResult({
        pronoun: oblique.punjabi,
        pronounRomanised: oblique.romanised,
        verbStem: verb.infinitive,
        verbStemRomanised: resolveStemRomanised(verb, verb.infinitive),
        ending: ending.punjabi,
        endingRomanised: ending.romanised,
        auxiliary: null,
        auxiliaryRomanised: null,
        englishGloss: `${personLabel} will have to ${verbGloss}`,
        verbWordLayout: layout,
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
