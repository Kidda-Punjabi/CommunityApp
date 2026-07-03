import type { ComprehensionMode } from "./config";

export type ComprehensionScript = {
  id: string;
  title: string;
  description: string | null;
  difficulty: number | null;
  display_order: number;
  active: boolean;
};

export type ComprehensionSentence = {
  id: string;
  script_id: string;
  sequence_order: number;
  gurmukhi_text: string;
  romanised_text: string;
  english_translation: string | null;
  audio_url: string | null;
};

export type ComprehensionQuestionOption = "a" | "b" | "c" | "d";

export type ComprehensionQuestion = {
  id: string;
  script_id: string;
  related_sentence_id: string | null;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: ComprehensionQuestionOption;
  sequence_order: number;
};

export type ComprehensionScriptSummary = ComprehensionScript & {
  sentence_count: number;
  question_count: number;
  listening_ready: boolean;
};

export type ComprehensionQuestionResult = {
  question_id: string;
  selected_option: ComprehensionQuestionOption;
  correct: boolean;
};

export type ComprehensionPracticeContent = {
  scripts: ComprehensionScriptSummary[];
  sentencesByScript: Record<string, ComprehensionSentence[]>;
  questionsByScript: Record<string, ComprehensionQuestion[]>;
  tablesReady: boolean;
  loadError: string | null;
};

export type ComprehensionViewerPreferences = {
  showGurmukhi: boolean;
  showRomanised: boolean;
};

export function defaultViewerPreferences(mode: ComprehensionMode): ComprehensionViewerPreferences {
  if (mode === "listening") {
    return { showGurmukhi: false, showRomanised: false };
  }
  return { showGurmukhi: true, showRomanised: true };
}

export function questionOptions(question: ComprehensionQuestion) {
  return [
    { id: "a" as const, label: question.option_a },
    { id: "b" as const, label: question.option_b },
    { id: "c" as const, label: question.option_c },
    { id: "d" as const, label: question.option_d },
  ];
}
