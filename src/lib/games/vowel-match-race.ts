import {
  buildVowelMatchOptions,
  encodeVowelAnswer,
  type VowelGameWord,
  type VowelMatchId,
} from "@/lib/games/vowel-match";

export type VowelMatchRacePayload = {
  question_id: string;
  flashcard_id: string;
  prompt: string;
  word_id: string;
  word_gurmukhi: string;
  audio_url: string;
  options: VowelMatchId[];
  correct_answer: string;
};

export function buildVowelMatchRacePayload(words: VowelGameWord[]): VowelMatchRacePayload {
  if (words.length === 0) {
    throw new Error("Vowel Match words are not ready yet.");
  }

  const word = words[Math.floor(Math.random() * words.length)]!;
  const options = buildVowelMatchOptions(word.vowels_tested, `${word.id}-${Date.now()}`);
  const questionId = `${word.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    question_id: questionId,
    flashcard_id: questionId,
    prompt: "Which vowel(s) do you hear?",
    word_id: word.id,
    word_gurmukhi: word.word_gurmukhi,
    audio_url: word.audio_pa_url,
    options: options.map((option) => option.id),
    correct_answer: encodeVowelAnswer(word.vowels_tested),
  };
}

export function isVowelMatchRacePayload(value: unknown): value is VowelMatchRacePayload {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.audio_url === "string" &&
    typeof record.correct_answer === "string" &&
    typeof record.word_gurmukhi === "string" &&
    Array.isArray(record.options)
  );
}
