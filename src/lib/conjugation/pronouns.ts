import type { AgreementSlot, Gender, Person } from "./types";

export type PronounSet = {
  punjabi: string;
  romanised: string;
};

export const SUBJECT_PRONOUNS: Record<Person, PronounSet> = {
  I: { punjabi: "ਮੈਂ", romanised: "main" },
  /** Legacy key — same as you_plural; course uses ਤੁਸੀਂ only (no informal ਤੂੰ). */
  you: { punjabi: "ਤੁਸੀਂ", romanised: "tusi" },
  he_she: { punjabi: "ਉਹ", romanised: "uh" },
  we: { punjabi: "ਅਸੀਂ", romanised: "aseen" },
  you_plural: { punjabi: "ਤੁਸੀਂ", romanised: "tusi" },
  they: { punjabi: "ਉਹ", romanised: "uh" },
};

export const OBLIQUE_PRONOUNS: Record<Person, PronounSet> = {
  I: { punjabi: "ਮੈਨੂੰ", romanised: "mainu" },
  you: { punjabi: "ਤੁਹਾਨੂੰ", romanised: "tuhaanu" },
  he_she: { punjabi: "ਉਸਨੂੰ", romanised: "usnu" },
  we: { punjabi: "ਸਾਨੂੰ", romanised: "sanu" },
  you_plural: { punjabi: "ਤੁਹਾਨੂੰ", romanised: "tuhaanu" },
  they: { punjabi: "ਉਹਨਾਂ ਨੂੰ", romanised: "ohna nu" },
};

/** Second-person uses plural verb agreement (ਤੁਸੀਂ + plural endings + ਹੋ/ਹਨ). */
export function isSecondPerson(person: Person): boolean {
  return person === "you" || person === "you_plural";
}

/** You and we always use masculine plural verb endings in this curriculum. */
export function personLocksMasculineGender(person: Person): boolean {
  return person === "we" || person === "you_plural" || person === "you";
}

export function getAgreementSlot(person: Person, gender: Gender): AgreementSlot {
  const isPlural =
    person === "we" || person === "you_plural" || person === "they" || person === "you";
  if (isPlural) {
    return gender === "masculine" ? "masc_pl" : "fem_pl";
  }
  return gender === "masculine" ? "masc_sg" : "fem_sg";
}

export function isPluralPerson(person: Person): boolean {
  return person === "we" || person === "you_plural" || person === "they" || person === "you";
}

export const PRESENT_AUX: Record<Person, PronounSet> = {
  I: { punjabi: "ਹਾਂ", romanised: "haan" },
  you: { punjabi: "ਹੋ", romanised: "ho" },
  he_she: { punjabi: "ਹੈ", romanised: "hai" },
  we: { punjabi: "ਹਾਂ", romanised: "haan" },
  you_plural: { punjabi: "ਹੋ", romanised: "ho" },
  they: { punjabi: "ਹਨ", romanised: "han" },
};

export const PAST_AUX: Record<Person, PronounSet> = {
  I: { punjabi: "ਸੀ", romanised: "see" },
  you: { punjabi: "ਸਨ", romanised: "san" },
  he_she: { punjabi: "ਸੀ", romanised: "see" },
  we: { punjabi: "ਸੀ", romanised: "see" },
  you_plural: { punjabi: "ਸਨ", romanised: "san" },
  they: { punjabi: "ਸਨ", romanised: "san" },
};

export const NECESSITY_PRESENT_AUX: Record<Person, PronounSet> = {
  I: { punjabi: "ਹੈ", romanised: "hai" },
  you: { punjabi: "ਹਨ", romanised: "han" },
  he_she: { punjabi: "ਹੈ", romanised: "hai" },
  we: { punjabi: "ਹਨ", romanised: "han" },
  you_plural: { punjabi: "ਹਨ", romanised: "han" },
  they: { punjabi: "ਹਨ", romanised: "han" },
};

export type EndingForms = Record<AgreementSlot, { punjabi: string; romanised: string }>;

export const HABITUAL_CONSONANT: EndingForms = {
  masc_sg: { punjabi: "ਦਾ", romanised: "daa" },
  fem_sg: { punjabi: "ਦੀ", romanised: "dee" },
  masc_pl: { punjabi: "ਦੇ", romanised: "de" },
  fem_pl: { punjabi: "ਦੀਆਂ", romanised: "diaan" },
};

export const HABITUAL_KANAA: EndingForms = {
  masc_sg: { punjabi: "ਂਦਾ", romanised: "ndaa" },
  fem_sg: { punjabi: "ਂਦੀ", romanised: "ndee" },
  masc_pl: { punjabi: "ਂਦੇ", romanised: "nde" },
  fem_pl: { punjabi: "ਂਦੀਆਂ", romanised: "ndiaan" },
};

export const HABITUAL_VOWEL: EndingForms = {
  masc_sg: { punjabi: "ਂਦਾ", romanised: "ndaa" },
  fem_sg: { punjabi: "ਂਦੀ", romanised: "ndee" },
  masc_pl: { punjabi: "ਂਦੇ", romanised: "nde" },
  fem_pl: { punjabi: "ਂਦੀਆਂ", romanised: "ndiaan" },
};

export const CONTINUOUS_ENDINGS: EndingForms = {
  masc_sg: { punjabi: "ਰਿਹਾ", romanised: "rihaa" },
  fem_sg: { punjabi: "ਰਹੀ", romanised: "rahee" },
  masc_pl: { punjabi: "ਰਹੇ", romanised: "rahe" },
  fem_pl: { punjabi: "ਰਹੀਆਂ", romanised: "rahiaan" },
};

export const ABILITY_ENDINGS: EndingForms = {
  masc_sg: { punjabi: "ਸਕਦਾ", romanised: "sakdaa" },
  fem_sg: { punjabi: "ਸਕਦੀ", romanised: "sakdee" },
  masc_pl: { punjabi: "ਸਕਦੇ", romanised: "sakde" },
  fem_pl: { punjabi: "ਸਕਦੀਆਂ", romanised: "sakdiaan" },
};

export const WANT_ENDINGS: EndingForms = {
  masc_sg: { punjabi: "ਚਾਹੁੰਦਾ", romanised: "chaahundaa" },
  fem_sg: { punjabi: "ਚਾਹੁੰਦੀ", romanised: "chaahundee" },
  masc_pl: { punjabi: "ਚਾਹੁੰਦੇ", romanised: "chaahunde" },
  fem_pl: { punjabi: "ਚਾਹੁੰਦੀਆਂ", romanised: "chaahundiaan" },
};

export const NECESSITY_PRESENT_ENDINGS: EndingForms = {
  masc_sg: { punjabi: "ਪੈਂਦਾ", romanised: "paindaa" },
  fem_sg: { punjabi: "ਪੈਂਦੀ", romanised: "paindee" },
  masc_pl: { punjabi: "ਪੈਂਦੇ", romanised: "painde" },
  fem_pl: { punjabi: "ਪੈਂਦੀਆਂ", romanised: "paindiaan" },
};

/** Simple past — consonant roots (Table 1a): sihari+aa / bihari fused to final consonant. */
export const PAST_SIMPLE_CONSONANT: EndingForms = {
  masc_sg: { punjabi: "ਿਆ", romanised: "iaa" },
  fem_sg: { punjabi: "ੀ", romanised: "ee" },
  masc_pl: { punjabi: "ੇ", romanised: "e" },
  fem_pl: { punjabi: "ੀਆਂ", romanised: "eeaan" },
};

/** Simple past — kanaa roots (Table 1b): root ends in aa, add aa/ee/ae/eeaan. */
export const PAST_SIMPLE_KANAA: EndingForms = {
  masc_sg: { punjabi: "ਆ", romanised: "aa" },
  fem_sg: { punjabi: "ਈ", romanised: "ee" },
  masc_pl: { punjabi: "ਏ", romanised: "e" },
  fem_pl: { punjabi: "ਈਆਂ", romanised: "eeaan" },
};

/** Simple past — vowel roots (Table 1c): same fused pattern as consonant. */
export const PAST_SIMPLE_VOWEL: EndingForms = {
  masc_sg: { punjabi: "ਆ", romanised: "aa" },
  fem_sg: { punjabi: "ਈ", romanised: "ee" },
  masc_pl: { punjabi: "ਏ", romanised: "e" },
  fem_pl: { punjabi: "ਈਆਂ", romanised: "eeaan" },
};

/** @deprecated Use root-class tables above. Kept as alias for kanaa. */
export const PAST_SIMPLE_REGULAR = PAST_SIMPLE_KANAA;

export const PERFECT_PARTICIPLE: EndingForms = {
  masc_sg: { punjabi: "ਚੁੱਕਾ", romanised: "chukkaa" },
  fem_sg: { punjabi: "ਚੁੱਕੀ", romanised: "chukkee" },
  masc_pl: { punjabi: "ਚੁੱਕੇ", romanised: "chukke" },
  fem_pl: { punjabi: "ਚੁੱਕੀਆਂ", romanised: "chukkiaan" },
};

export const PAST_NECESSITY_ENDINGS: EndingForms = {
  masc_sg: { punjabi: "ਪਿਆ", romanised: "piaa" },
  fem_sg: { punjabi: "ਪਈ", romanised: "paee" },
  masc_pl: { punjabi: "ਪਏ", romanised: "pe" },
  fem_pl: { punjabi: "ਪਈਆਂ", romanised: "paeeaan" },
};

export const FUTURE_SIMPLE_FUSED: EndingForms = {
  masc_sg: { punjabi: "ਾਂਗਾ", romanised: "aangaa" },
  fem_sg: { punjabi: "ਾਂਗੀ", romanised: "aangee" },
  masc_pl: { punjabi: "ਾਂਗੇ", romanised: "aange" },
  fem_pl: { punjabi: "ਾਂਗੀਆਂ", romanised: "aangiaan" },
};

/** Simple future — you (ਤੁਸੀਂ): consonant root + oge (e.g. ਪੜ੍ਹੋਗੇ). */
export const FUTURE_SIMPLE_CONSONANT_YOU: EndingForms = {
  masc_sg: { punjabi: "ੋਗੇ", romanised: "oge" },
  fem_sg: { punjabi: "ੋਗੀ", romanised: "ogee" },
  masc_pl: { punjabi: "ੋਗੇ", romanised: "oge" },
  fem_pl: { punjabi: "ੋਗੀਆਂ", romanised: "ogeaan" },
};

export const FUTURE_SIMPLE_HE_SHE: EndingForms = {
  masc_sg: { punjabi: "ਏਗਾ", romanised: "egaa" },
  fem_sg: { punjabi: "ਏਗੀ", romanised: "egee" },
  masc_pl: { punjabi: "ਣਗੇ", romanised: "nage" },
  fem_pl: { punjabi: "ਣਗੀਆਂ", romanised: "nagiaan" },
};

export const FUTURE_PERFECT_AUX: EndingForms = {
  masc_sg: { punjabi: "ਹੋਵੇਗਾ", romanised: "hovegaa" },
  fem_sg: { punjabi: "ਹੋਵੇਗੀ", romanised: "hovegee" },
  masc_pl: { punjabi: "ਹੋਣਗੇ", romanised: "honnge" },
  fem_pl: { punjabi: "ਹੋਣਗੀਆਂ", romanised: "honngeean" },
};

export const FUTURE_ABILITY_FUSED: EndingForms = {
  masc_sg: { punjabi: "ਸਕਾਂਗਾ", romanised: "sakaangaa" },
  fem_sg: { punjabi: "ਸਕਾਂਗੀ", romanised: "sakaangee" },
  masc_pl: { punjabi: "ਸਕਾਂਗੇ", romanised: "sakaange" },
  fem_pl: { punjabi: "ਸਕਾਂਗੀਆਂ", romanised: "sakaangiaan" },
};

/** Future ability — you (ਤੁਸੀਂ): root + sakoge (e.g. ਪੜ੍ਹਸਕੋਗੇ). */
export const FUTURE_ABILITY_CONSONANT_YOU: EndingForms = {
  masc_sg: { punjabi: "ਸਕੋਗੇ", romanised: "sakoge" },
  fem_sg: { punjabi: "ਸਕੋਗੀ", romanised: "sakogee" },
  masc_pl: { punjabi: "ਸਕੋਗੇ", romanised: "sakoge" },
  fem_pl: { punjabi: "ਸਕੋਗੀਆਂ", romanised: "sakogeaan" },
};

export const FUTURE_ABILITY_HE_SHE: EndingForms = {
  masc_sg: { punjabi: "ਸਕੇਗਾ", romanised: "sakegaa" },
  fem_sg: { punjabi: "ਸਕੇਗੀ", romanised: "sakegee" },
  masc_pl: { punjabi: "ਸਕਣਗੇ", romanised: "sakange" },
  fem_pl: { punjabi: "ਸਕਣਗੀਆਂ", romanised: "sakangiaan" },
};

export const FUTURE_NECESSITY_FUSED: EndingForms = {
  masc_sg: { punjabi: "ਪਵੇਗਾ", romanised: "pavegaa" },
  fem_sg: { punjabi: "ਪਵੇਗੀ", romanised: "pavegee" },
  masc_pl: { punjabi: "ਪਵਣਗੇ", romanised: "pavange" },
  fem_pl: { punjabi: "ਪਵਣਗੀਆਂ", romanised: "pavangiaan" },
};

export function pickEnding(
  table: EndingForms,
  slot: AgreementSlot
): { punjabi: string; romanised: string } {
  return table[slot];
}
