import { gurmukhiOptionName } from "@/lib/learn/gurmukhi-letter-names";

export const WORD_START_GAME_TYPE = "word_start" as const;
export const WORD_START_DISPLAY_NAME = "Word Start";
export const WORD_START_QUESTION_COUNTS = [5, 10, 15, 20] as const;

export type WordStartGameWord = {
  id: string;
  word_gurmukhi: string;
  meaning_english: string;
  romanised: string;
  starting_letter: string;
  distractor_letters: string[];
  audio_pa_url: string;
};

export type WordStartQuestion = {
  word: WordStartGameWord;
  options: string[];
};

export type WordStartQuestionResult = {
  word_id: string;
  word_gurmukhi: string;
  romanised: string;
  selected: string;
  correct: string;
  is_correct: boolean;
};

export function letterLabel(glyph: string): string {
  const name = gurmukhiOptionName(glyph);
  return name ? `${glyph}  ${name}` : glyph;
}

export function parseDistractorLetters(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildOptions(word: WordStartGameWord): string[] {
  const unique = [
    ...new Set(
      [word.starting_letter, ...word.distractor_letters]
        .map((glyph) => glyph.trim())
        .filter(Boolean)
    ),
  ];
  return shuffle(unique);
}

export function buildWordStartRound(
  words: WordStartGameWord[],
  questionCount: number
): WordStartQuestion[] {
  const playable = words.filter((word) => word.audio_pa_url && word.starting_letter);
  if (playable.length === 0 || questionCount <= 0) return [];

  const shuffled = shuffle(playable);
  const sequence: WordStartGameWord[] = [];
  let index = 0;
  while (sequence.length < questionCount) {
    sequence.push(shuffled[index % shuffled.length]!);
    index += 1;
  }

  return sequence.map((word) => ({
    word,
    options: buildOptions(word),
  }));
}
