import type { PossessiveTier } from "./config";
import type { GenderedNoun } from "@/lib/games/types";

export type PossessiveForm = {
  id: string;
  person_english: string;
  masc_sg_gurmukhi: string;
  masc_sg_romanised: string;
  fem_sg_gurmukhi: string;
  fem_sg_romanised: string;
  oblique_gurmukhi: string;
  oblique_romanised: string;
  display_order: number;
};

export type Postposition = {
  id: string;
  gurmukhi: string;
  romanised: string;
  english: string;
};

export type PossessiveOption = {
  id: string;
  gurmukhi: string;
  romanised: string;
  english: string;
};

export type PossessiveQuestion = {
  id: string;
  tier: "normal" | "oblique";
  promptEnglish: string;
  possessiveFormId: string;
  nounId: string;
  postpositionId: string | null;
  options: PossessiveOption[];
  correctOptionId: string;
};

export type PossessiveQuestionResult = {
  possessive_form_id: string;
  noun_id: string;
  postposition_id: string | null;
  selected_option: string;
  correct: boolean;
};

export type PossessivePracticeContent = {
  nouns: GenderedNoun[];
  possessiveForms: PossessiveForm[];
  postpositions: Postposition[];
  tablesReady: boolean;
  loadError: string | null;
};

export type PossessiveRoundSettings = {
  tier: PossessiveTier;
  questionCount: number;
};

export type PossessivePracticeMetadata = {
  accuracy: number;
  correct: number;
  total: number;
  tier: PossessiveTier;
  question_count: number;
  questions: PossessiveQuestionResult[];
};
