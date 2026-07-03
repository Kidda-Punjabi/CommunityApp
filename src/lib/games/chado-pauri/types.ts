export type ChadoPauriFlashcard = {
  id: string;
  front_text: string;
  back_text: string;
  romanised: string | null;
  category: string | null;
  difficulty: number;
  topic_tags: string[];
};

export type ChadoPauriOption = {
  key: string;
  text: string;
  isCorrect: boolean;
};

export type ChadoPauriQuestion = {
  flashcardId: string;
  prompt: string;
  correctAnswer: string;
  options: ChadoPauriOption[];
  targetDifficulty: number;
  actualDifficulty: number;
  usedDifficultyFallback: boolean;
  category: string | null;
  topic_tags: string[];
};

export type ChadoPauriRungResult = {
  rung: number;
  points: number;
  flashcard_id: string;
  correct: boolean;
  lifelines_used: string[];
};

export type ChadoPauriGameMetadata = {
  accuracy: number;
  correct: number;
  total: number;
  final_score: number;
  won: boolean;
  rungs: ChadoPauriRungResult[];
  lifelines_used_overall: string[];
  difficulty_fallbacks: number;
};
