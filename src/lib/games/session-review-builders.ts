import type { ChallengeQuestion } from "@/lib/conjugation/challenge";
import type { SentenceBuilderQuestion } from "@/lib/conjugation/sentence-builder";
import type { SentenceTile } from "@/lib/conjugation/sentence-builder";
import type { AdjectiveAgreementQuestion } from "@/lib/games/gender-sort-adjectives";
import type { GenderedNoun } from "@/lib/games/types";
import type { RoundResult } from "@/lib/games/session-review";

function joinRomanised(parts: string[]): string | undefined {
  const line = parts.map((part) => part.trim()).filter(Boolean).join(" ");
  return line || undefined;
}

export function buildSentenceBuilderLogEntry(
  question: SentenceBuilderQuestion,
  built: SentenceTile[],
  wasCorrect: boolean
): RoundResult {
  return {
    prompt: question.englishPrompt,
    promptRomanised: question.romanised ?? undefined,
    omitPromptRomanisedWhenIncorrect: true,
    userAnswer: built.map((tile) => tile.word).join(" "),
    userAnswerRomanised: joinRomanised(built.map((tile) => tile.romanised)),
    correctAnswer: question.correctTiles.join(" "),
    correctAnswerRomanised:
      joinRomanised(question.correctTileRomanised) ?? question.romanised ?? undefined,
    wasCorrect,
  };
}

export function conjugationChallengePrompt(question: ChallengeQuestion): {
  prompt: string;
  promptRomanised?: string;
} {
  if (question.format === "B") {
    return {
      prompt: question.gapSentence ?? question.englishGloss,
      promptRomanised: question.gapSentenceRomanised,
    };
  }

  return {
    prompt: `${question.verbRoot} ___ — ${question.english}`,
    promptRomanised: question.verbRootRomanised
      ? `${question.verbRootRomanised} ___`
      : undefined,
  };
}

export function buildConjugationChallengeLogEntry(
  question: ChallengeQuestion,
  selectedAnswer: string,
  wasCorrect: boolean
): RoundResult {
  const selected = question.options.find((option) => option.punjabi === selectedAnswer);
  const { prompt, promptRomanised } = conjugationChallengePrompt(question);

  return {
    prompt,
    promptRomanised,
    userAnswer: selectedAnswer,
    userAnswerRomanised: selected?.romanised || undefined,
    correctAnswer: question.correctAnswer,
    correctAnswerRomanised: question.correctAnswerRomanised || undefined,
    wasCorrect,
  };
}

export function genderLabel(gender: "masculine" | "feminine"): string {
  return gender === "masculine" ? "Masculine" : "Feminine";
}

export function buildGenderSortNounLogEntry(
  noun: GenderedNoun,
  guess: "masculine" | "feminine",
  wasCorrect: boolean
): RoundResult {
  return {
    prompt: `${noun.punjabi_word} — ${noun.english_meaning}`,
    promptRomanised: noun.romanised ?? undefined,
    userAnswer: genderLabel(guess),
    correctAnswer: genderLabel(noun.gender),
    wasCorrect,
  };
}

export function buildGenderSortAdjectiveLogEntry(
  question: AdjectiveAgreementQuestion,
  selectedAnswer: string,
  wasCorrect: boolean
): RoundResult {
  const selected = question.options.find((option) => option.punjabi === selectedAnswer);

  return {
    prompt: `${question.nounEnglish} (${question.nounGender} ${question.nounNumber}) — pick ${question.adjectiveEnglish}`,
    userAnswer: selectedAnswer,
    userAnswerRomanised: selected?.romanised,
    correctAnswer: question.correctAnswer,
    correctAnswerRomanised: question.correctRomanised,
    wasCorrect,
  };
}
