export const GAME_TYPES = [
  "match",
  "memory_grid",
  "speed_translate",
  "streak_survival",
  "sentence_builder",
  "conjugation_challenge",
  "gender_sort",
  "picture_match",
  "voice_practice",
  "chado_pauri",
  "conversation_practice",
  "possessive_practice",
  "spot_the_mistake",
  "comprehension_practice",
  "lane_runner",
  "speaking_practice",
  "vowel_match",
  "sound_match",
  "word_start",
] as const;

export type GameType = (typeof GAME_TYPES)[number];

export type VerbConjugations = {
  present?: {
    singular?: { masculine?: string; feminine?: string };
    plural?: { masculine?: string; feminine?: string };
  };
  past?: {
    singular?: { masculine?: string; feminine?: string };
    plural?: { masculine?: string; feminine?: string };
  };
  future?: {
    singular?: { masculine?: string; feminine?: string };
    plural?: { masculine?: string; feminine?: string };
  };
};

export type DistractorConjugation = {
  gurmukhi: string;
  romanised: string;
};

export type WordTile = {
  gurmukhi: string;
  romanised: string;
};

export type GrammarSentence = {
  id: string;
  punjabi_sentence: string;
  english_translation: string;
  word_tiles: WordTile[];
  difficulty: number;
  topic_tags: string[];
  course_id: string | null;
  lesson_id: string | null;
  tense: string | null;
  is_question: boolean;
  question_type: string | null;
  is_negative: boolean;
  target_verb_gurmukhi: string | null;
  target_verb_romanised: string | null;
  target_verb_root_gurmukhi: string | null;
  target_verb_root_romanised: string | null;
  distractor_conjugations: DistractorConjugation[];
  created_at: string;
};

export type VerbConjugation = {
  id: string;
  verb_root: string;
  verb_meaning: string;
  conjugations: VerbConjugations;
  difficulty: number;
  course_id: string | null;
  created_at: string;
};

export type GenderedNoun = {
  id: string;
  punjabi_word: string;
  english_meaning: string;
  romanised: string | null;
  gender: "masculine" | "feminine";
  difficulty: number;
  topic_tags: string[];
  course_id: string | null;
  created_at: string;
};

export type GameScoreRow = {
  id: string;
  user_id: string;
  game_type: GameType;
  score: number;
  metadata: Record<string, unknown>;
  achieved_at: string;
};

export type UserGameStats = {
  user_id: string;
  total_games_played: number;
  favourite_game: GameType | null;
  highest_streak_survival_score: number;
  updated_at: string;
};

export type ConjugationPrompt = {
  tense: "present" | "past" | "future";
  number: "singular" | "plural";
  gender: "masculine" | "feminine";
  label: string;
  answer: string;
};

export const CONJUGATION_PROMPTS: Omit<ConjugationPrompt, "answer">[] = [
  { tense: "present", number: "singular", gender: "masculine", label: "Present, singular, masculine" },
  { tense: "present", number: "singular", gender: "feminine", label: "Present, singular, feminine" },
  { tense: "present", number: "plural", gender: "masculine", label: "Present, plural, masculine" },
  { tense: "present", number: "plural", gender: "feminine", label: "Present, plural, feminine" },
  { tense: "past", number: "singular", gender: "masculine", label: "Past, singular, masculine" },
  { tense: "past", number: "singular", gender: "feminine", label: "Past, singular, feminine" },
  { tense: "past", number: "plural", gender: "masculine", label: "Past, plural, masculine" },
  { tense: "past", number: "plural", gender: "feminine", label: "Past, plural, feminine" },
  { tense: "future", number: "singular", gender: "masculine", label: "Future, singular, masculine" },
  { tense: "future", number: "singular", gender: "feminine", label: "Future, singular, feminine" },
  { tense: "future", number: "plural", gender: "masculine", label: "Future, plural, masculine" },
  { tense: "future", number: "plural", gender: "feminine", label: "Future, plural, feminine" },
];

export function getConjugationForm(
  conjugations: VerbConjugations,
  tense: ConjugationPrompt["tense"],
  number: ConjugationPrompt["number"],
  gender: ConjugationPrompt["gender"]
): string | null {
  const form = conjugations[tense]?.[number]?.[gender];
  return form?.trim() || null;
}

export function splitPunjabiTiles(sentence: string): string[] {
  return sentence.trim().split(/\s+/).filter(Boolean);
}

export function parseTopicTags(raw: string): string[] {
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}
