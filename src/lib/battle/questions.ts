import type { SupabaseClient } from "@supabase/supabase-js";
import { parseDistractorConjugations } from "@/lib/games/grammar-sentence";
import type { GrammarSentence, GenderedNoun } from "@/lib/games/types";
import type { BattleGameSource } from "@/lib/battle/constants";
import type {
  BattleQuestionPayload,
  ConjugationChallengeQuestionPayload,
  GenderSortQuestionPayload,
} from "@/lib/battle/types";

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildGenderSortQuestion(noun: GenderedNoun): GenderSortQuestionPayload {
  return {
    type: "gender_sort",
    nounId: noun.id,
    punjabiWord: noun.punjabi_word,
    englishMeaning: noun.english_meaning,
    romanised: noun.romanised,
    correctAnswer: noun.gender,
  };
}

function buildConjugationQuestion(sentence: GrammarSentence): ConjugationChallengeQuestionPayload | null {
  const correctVerb = sentence.target_verb_gurmukhi?.trim();
  if (!correctVerb) return null;

  const distractors = parseDistractorConjugations(sentence.distractor_conjugations);
  if (distractors.length < 2) return null;

  const options = shuffle([
    {
      gurmukhi: correctVerb,
      romanised: sentence.target_verb_romanised?.trim() ?? "",
    },
    ...distractors.map((d) => ({
      gurmukhi: d.gurmukhi,
      romanised: d.romanised,
    })),
  ]);

  const verb = sentence.target_verb_gurmukhi?.trim() ?? "";
  const index = sentence.punjabi_sentence.indexOf(verb);
  const prompt =
    index >= 0
      ? `${sentence.punjabi_sentence.slice(0, index)}___${sentence.punjabi_sentence.slice(index + verb.length)}`
      : sentence.punjabi_sentence;

  return {
    type: "conjugation_challenge",
    sentenceId: sentence.id,
    prompt,
    englishGloss: sentence.english_translation,
    options,
    correctAnswer: correctVerb,
  };
}

export function isAnswerCorrect(
  payload: BattleQuestionPayload,
  answer: string
): boolean {
  const trimmed = answer.trim();
  if (payload.type === "gender_sort") {
    return trimmed === payload.correctAnswer;
  }
  return trimmed === payload.correctAnswer;
}

export async function pickBattleQuestion(
  supabase: SupabaseClient,
  gameSource: BattleGameSource,
  learnerLevel: number | null
): Promise<BattleQuestionPayload> {
  const level = learnerLevel ?? 3;

  if (gameSource === "gender_sort") {
    const { data, error } = await supabase
      .from("gendered_nouns")
      .select("id, punjabi_word, english_meaning, romanised, gender, difficulty")
      .gte("difficulty", Math.max(1, level - 2))
      .lte("difficulty", level + 2);

    if (error) throw error;
    const pool = (data ?? []) as GenderedNoun[];
    if (pool.length === 0) {
      const { data: fallback } = await supabase.from("gendered_nouns").select("*").limit(50);
      if (!fallback?.length) throw new Error("No gender sort content available.");
      return buildGenderSortQuestion(shuffle(fallback as GenderedNoun[])[0]);
    }
    return buildGenderSortQuestion(shuffle(pool)[0]);
  }

  const { data, error } = await supabase.from("grammar_sentences").select("*");
  if (error) throw error;

  const ready = (data ?? [])
    .map((row) => row as GrammarSentence)
    .filter((sentence) => {
      if (!sentence.target_verb_gurmukhi?.trim()) return false;
      return parseDistractorConjugations(sentence.distractor_conjugations).length >= 2;
    });

  if (ready.length === 0) throw new Error("No conjugation challenge content available.");

  for (const sentence of shuffle(ready)) {
    const question = buildConjugationQuestion(sentence);
    if (question) return question;
  }

  throw new Error("Could not build conjugation question.");
}
