import type { DistractorConjugation } from "@/lib/games/types";
import type { SpotMistakeKind, SpotMistakeWord } from "./mistake-slots";

export type SpotSentenceToken = {
  id: string;
  gurmukhi: string;
  romanised: string;
  isMistake: boolean;
};

export type SpotFixOption = {
  id: string;
  gurmukhi: string;
  romanised: string;
};

export type SpotTheMistakeQuestion = {
  id: string;
  grammarSentenceId: string;
  mistakeKind: SpotMistakeKind;
  slotGurmukhi: string;
  correctWord: SpotMistakeWord;
  mistakeWord: SpotMistakeWord;
  brokenPunjabi: string;
  brokenRomanised: string;
  correctedPunjabi: string;
  correctedRomanised: string;
  englishTranslation: string;
  tokens: SpotSentenceToken[];
  correctedTokens: SpotSentenceToken[];
  fixOptions: SpotFixOption[];
  correctFixOptionId: string;
};

export type SpotTheMistakeQuestionResult = {
  grammar_sentence_id: string;
  spot_correct_first_try: boolean;
  fix_correct_first_try: boolean;
};

export type SpotTheMistakeMetadata = {
  accuracy: number;
  correct: number;
  total: number;
  question_count: number;
  questions: SpotTheMistakeQuestionResult[];
};
