export type Person = "I" | "you" | "he_she" | "we" | "you_plural" | "they";
export type Gender = "masculine" | "feminine";
export type RootClass = "consonant" | "kanaa" | "vowel";

export type TenseId =
  | "present_habitual"
  | "present_continuous"
  | "present_ability"
  | "present_want"
  | "present_necessity"
  | "past_simple"
  | "past_perfect"
  | "past_habitual"
  | "past_continuous"
  | "past_ability"
  | "past_necessity"
  | "future_simple"
  | "future_perfect"
  | "future_ability"
  | "future_necessity";

export type AgreementSlot = "masc_sg" | "fem_sg" | "masc_pl" | "fem_pl";

export type Verb = {
  id: string;
  infinitive: string;
  infinitiveRomanised: string | null;
  english: string;
  root: string;
  rootRomanised: string | null;
  rootClass: RootClass;
  isIrregular: boolean;
  irregularPastMascSg: string | null;
  irregularPastFemSg: string | null;
  irregularPastMascPl: string | null;
  irregularPastFemPl: string | null;
  hasTippiInsertion: boolean;
  notes: string | null;
};

export type ConjugationResult = {
  pronoun: string;
  pronounRomanised: string;
  root: string;
  ending: string;
  endingRomanised: string;
  auxiliary: string | null;
  auxiliaryRomanised: string | null;
  fullPunjabi: string;
  fullRomanised: string;
  englishGloss: string;
  explanation: string;
};

export type TenseGroup = "present" | "past" | "future";

export type TenseMeta = {
  id: TenseId;
  label: string;
  group: TenseGroup;
  shortLabel: string;
};

export const TENSE_CATALOG: TenseMeta[] = [
  { id: "present_habitual", label: "Present habitual", group: "present", shortLabel: "Habitual" },
  { id: "present_continuous", label: "Present continuous", group: "present", shortLabel: "Continuous" },
  { id: "present_ability", label: "Present ability (can)", group: "present", shortLabel: "Can" },
  { id: "present_want", label: "Present want", group: "present", shortLabel: "Want" },
  { id: "present_necessity", label: "Present necessity (have to)", group: "present", shortLabel: "Have to" },
  { id: "past_simple", label: "Simple past", group: "past", shortLabel: "Simple" },
  { id: "past_perfect", label: "Past perfect", group: "past", shortLabel: "Perfect" },
  { id: "past_habitual", label: "Past habitual", group: "past", shortLabel: "Used to" },
  { id: "past_continuous", label: "Past continuous", group: "past", shortLabel: "Was -ing" },
  { id: "past_ability", label: "Past ability (could)", group: "past", shortLabel: "Could" },
  { id: "past_necessity", label: "Past necessity (had to)", group: "past", shortLabel: "Had to" },
  { id: "future_simple", label: "Simple future", group: "future", shortLabel: "Will" },
  { id: "future_perfect", label: "Future perfect", group: "future", shortLabel: "Will have" },
  { id: "future_ability", label: "Future ability (will be able)", group: "future", shortLabel: "Will be able" },
  { id: "future_necessity", label: "Future necessity (will have to)", group: "future", shortLabel: "Will have to" },
];

export const PERSON_OPTIONS: { person: Person; label: string }[] = [
  { person: "I", label: "I" },
  { person: "you", label: "You (singular)" },
  { person: "he_she", label: "He / She" },
  { person: "we", label: "We" },
  { person: "you_plural", label: "You (plural)" },
  { person: "they", label: "They" },
];
