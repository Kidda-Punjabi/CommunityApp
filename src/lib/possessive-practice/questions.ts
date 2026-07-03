import { shuffleArray } from "@/lib/flashcards/utils";
import { pickCycledPool } from "@/lib/games/session-settings";
import type { GenderedNoun } from "@/lib/games/types";
import type { PossessiveTier } from "./config";
import type {
  PossessiveForm,
  PossessiveOption,
  PossessiveQuestion,
  Postposition,
} from "./types";

type FormVariant = "masc_sg" | "fem_sg" | "oblique";

function variantLabel(personEnglish: string, variant: FormVariant): string {
  if (variant === "masc_sg") return `${personEnglish} (masculine)`;
  if (variant === "fem_sg") return `${personEnglish} (feminine)`;
  return `${personEnglish} (oblique)`;
}

function optionFrom(form: PossessiveForm, variant: FormVariant): PossessiveOption {
  switch (variant) {
    case "masc_sg":
      return {
        id: `${form.id}-masc_sg`,
        gurmukhi: form.masc_sg_gurmukhi,
        romanised: form.masc_sg_romanised,
        english: variantLabel(form.person_english, variant),
      };
    case "fem_sg":
      return {
        id: `${form.id}-fem_sg`,
        gurmukhi: form.fem_sg_gurmukhi,
        romanised: form.fem_sg_romanised,
        english: variantLabel(form.person_english, variant),
      };
    case "oblique":
      return {
        id: `${form.id}-oblique`,
        gurmukhi: form.oblique_gurmukhi,
        romanised: form.oblique_romanised,
        english: variantLabel(form.person_english, variant),
      };
  }
}

function correctVariant(
  tier: "normal" | "oblique",
  nounGender: GenderedNoun["gender"]
): FormVariant {
  if (tier === "normal") {
    return nounGender === "masculine" ? "masc_sg" : "fem_sg";
  }
  return nounGender === "masculine" ? "oblique" : "fem_sg";
}

function buildPromptEnglish(
  form: PossessiveForm,
  noun: GenderedNoun,
  tier: "normal" | "oblique",
  postposition: Postposition | null
): string {
  const phrase = `${form.person_english} ${noun.english_meaning}`;
  if (tier === "oblique" && postposition) {
    return `${postposition.english} ${phrase}`;
  }
  return phrase;
}

function buildDistractorCandidates(
  form: PossessiveForm,
  allForms: PossessiveForm[],
  tier: "normal" | "oblique",
  nounGender: GenderedNoun["gender"],
  correctVariantKey: FormVariant
): Array<{ form: PossessiveForm; variant: FormVariant }> {
  const candidates: Array<{ form: PossessiveForm; variant: FormVariant }> = [];

  for (const variant of ["masc_sg", "fem_sg", "oblique"] as FormVariant[]) {
    if (variant !== correctVariantKey) {
      candidates.push({ form, variant });
    }
  }

  if (tier === "oblique" && nounGender === "feminine") {
    candidates.unshift({ form, variant: "oblique" });
  }
  if (tier === "oblique" && nounGender === "masculine") {
    candidates.unshift({ form, variant: "masc_sg" });
  }

  for (const other of allForms) {
    if (other.id === form.id) continue;
    candidates.push({ form: other, variant: correctVariantKey });
    const wrongGender: FormVariant =
      correctVariantKey === "masc_sg" || correctVariantKey === "oblique"
        ? "fem_sg"
        : "masc_sg";
    candidates.push({ form: other, variant: wrongGender });
    if (tier === "oblique") {
      candidates.push({ form: other, variant: "oblique" });
    }
  }

  return candidates;
}

function buildOptions(
  form: PossessiveForm,
  allForms: PossessiveForm[],
  tier: "normal" | "oblique",
  nounGender: GenderedNoun["gender"]
): PossessiveOption[] {
  const correctKey = correctVariant(tier, nounGender);
  const correctOption = optionFrom(form, correctKey);
  const seen = new Set([correctOption.gurmukhi]);
  const distractors: PossessiveOption[] = [];

  const candidates = buildDistractorCandidates(
    form,
    allForms,
    tier,
    nounGender,
    correctKey
  );

  for (const candidate of shuffleArray(candidates)) {
    const option = optionFrom(candidate.form, candidate.variant);
    if (seen.has(option.gurmukhi)) continue;
    seen.add(option.gurmukhi);
    distractors.push(option);
    if (distractors.length >= 3) break;
  }

  while (distractors.length < 3) {
    const fallback = allForms.find((other) => other.id !== form.id) ?? form;
    const variant = (["masc_sg", "fem_sg", "oblique"] as FormVariant[]).find((key) => {
      const option = optionFrom(fallback, key);
      return !seen.has(option.gurmukhi) && key !== correctKey;
    });
    if (!variant) break;
    const option = optionFrom(fallback, variant);
    seen.add(option.gurmukhi);
    distractors.push(option);
  }

  return shuffleArray([correctOption, ...distractors]);
}

export function buildPossessiveQuestion(
  form: PossessiveForm,
  noun: GenderedNoun,
  allForms: PossessiveForm[],
  tier: "normal" | "oblique",
  postposition: Postposition | null,
  index: number
): PossessiveQuestion {
  const options = buildOptions(form, allForms, tier, noun.gender);
  const correctKey = correctVariant(tier, noun.gender);
  const correctOptionId = optionFrom(form, correctKey).id;

  return {
    id: `q-${index}-${form.id}-${noun.id}`,
    tier,
    promptEnglish: buildPromptEnglish(form, noun, tier, postposition),
    possessiveFormId: form.id,
    nounId: noun.id,
    postpositionId: postposition?.id ?? null,
    options,
    correctOptionId,
  };
}

export function buildPossessiveRound(
  nouns: GenderedNoun[],
  forms: PossessiveForm[],
  postpositions: Postposition[],
  tier: PossessiveTier,
  questionCount: number
): PossessiveQuestion[] {
  if (nouns.length === 0 || forms.length === 0) return [];
  if (tier === "oblique" && postpositions.length === 0) return [];

  const nounPool = pickCycledPool(nouns, questionCount);
  const formPool = pickCycledPool(forms, questionCount);
  const postpositionPool =
    tier === "oblique" || tier === "mixed"
      ? pickCycledPool(postpositions, questionCount)
      : [];

  const questions: PossessiveQuestion[] = [];

  for (let index = 0; index < questionCount; index += 1) {
    const questionTier: "normal" | "oblique" =
      tier === "mixed" ? (Math.random() < 0.5 ? "normal" : "oblique") : tier;
    const postposition =
      questionTier === "oblique" ? (postpositionPool[index] ?? postpositions[0]) : null;

    questions.push(
      buildPossessiveQuestion(
        formPool[index],
        nounPool[index],
        forms,
        questionTier,
        postposition,
        index
      )
    );
  }

  return questions;
}
