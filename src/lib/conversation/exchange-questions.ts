import { shuffleArray } from "@/lib/flashcards/utils";
import { answersMatch } from "@/lib/conjugation/sentence-builder";
import type { SentenceTile } from "@/lib/conjugation/sentence-builder";
import type { ConversationExchange, ConversationHardWordTile } from "./types";

export type EasyWordOption = {
  id: string;
  gurmukhi: string;
  romanised: string | null;
  isCorrect: boolean;
};

export type MediumSentenceOption = {
  id: string;
  gurmukhi: string;
  romanised: string | null;
  english: string;
  isCorrect: boolean;
};

export function buildEasyOptions(exchange: ConversationExchange): EasyWordOption[] {
  const options: EasyWordOption[] = [
    {
      id: "correct",
      gurmukhi: exchange.easy_correct_word_gurmukhi,
      romanised: exchange.easy_correct_word_romanised,
      isCorrect: true,
    },
    {
      id: "b",
      gurmukhi: exchange.easy_option_b_gurmukhi,
      romanised: exchange.easy_option_b_romanised,
      isCorrect: false,
    },
    {
      id: "c",
      gurmukhi: exchange.easy_option_c_gurmukhi,
      romanised: exchange.easy_option_c_romanised,
      isCorrect: false,
    },
    {
      id: "d",
      gurmukhi: exchange.easy_option_d_gurmukhi,
      romanised: exchange.easy_option_d_romanised,
      isCorrect: false,
    },
  ];

  return shuffleArray(options).map((option, index) => ({
    ...option,
    id: `${option.id}-${index}`,
  }));
}

export function buildMediumOptions(exchange: ConversationExchange): MediumSentenceOption[] {
  const options: MediumSentenceOption[] = [
    {
      id: "correct",
      gurmukhi: exchange.target_response_gurmukhi,
      romanised: exchange.target_response_romanised,
      english: exchange.target_response_english,
      isCorrect: true,
    },
    {
      id: "b",
      gurmukhi: exchange.medium_option_b_gurmukhi,
      romanised: exchange.medium_option_b_romanised,
      english: exchange.medium_option_b_english,
      isCorrect: false,
    },
    {
      id: "c",
      gurmukhi: exchange.medium_option_c_gurmukhi,
      romanised: exchange.medium_option_c_romanised,
      english: exchange.medium_option_c_english,
      isCorrect: false,
    },
    {
      id: "d",
      gurmukhi: exchange.medium_option_d_gurmukhi,
      romanised: exchange.medium_option_d_romanised,
      english: exchange.medium_option_d_english,
      isCorrect: false,
    },
  ];

  return shuffleArray(options).map((option, index) => ({
    ...option,
    id: `${option.id}-${index}`,
  }));
}

export function correctHardTileSequence(tiles: ConversationHardWordTile[]): string[] {
  return tiles
    .filter((tile) => !tile.is_distractor)
    .sort((a, b) => a.correct_position - b.correct_position)
    .map((tile) => tile.gurmukhi);
}

export function buildHardTileBank(
  tiles: ConversationHardWordTile[],
  exchangeId: string
): SentenceTile[] {
  return shuffleArray(tiles).map((tile, index) => ({
    id: `${exchangeId}-${tile.gurmukhi}-${index}`,
    word: tile.gurmukhi,
    romanised: tile.romanised,
  }));
}

export function hardAnswerMatches(
  built: string[],
  tiles: ConversationHardWordTile[]
): boolean {
  return answersMatch(built, correctHardTileSequence(tiles));
}

export function fillEasyBlank(
  template: string,
  selectedWord: string | null
): string {
  if (!selectedWord) return template;
  return template.replace("___", selectedWord);
}

function replaceFirstOccurrence(
  text: string,
  needle: string,
  replacement: string
): string {
  const index = text.indexOf(needle);
  if (index === -1) return text;
  return text.slice(0, index) + replacement + text.slice(index + needle.length);
}

/** Derive a romanised fill-in-the-blank line from the full response + correct word. */
export function buildEasyRomanisedBlankTemplate(
  exchange: ConversationExchange
): string | null {
  const full = exchange.target_response_romanised?.trim();
  if (!full) return null;

  const word = exchange.easy_correct_word_romanised?.trim();
  if (word) {
    const withBlank = replaceFirstOccurrence(full, word, "___");
    if (withBlank !== full) return withBlank;
  }

  const blankIndex = exchange.easy_blank_template_gurmukhi.indexOf("___");
  if (blankIndex === -1) return null;

  const wordsBeforeBlank = (exchange.easy_blank_template_gurmukhi.slice(0, blankIndex).match(/\S+/g) ?? [])
    .length;
  const romanisedWords = full.split(/\s+/).filter(Boolean);
  if (wordsBeforeBlank >= romanisedWords.length) return null;

  return [
    ...romanisedWords.slice(0, wordsBeforeBlank),
    "___",
    ...romanisedWords.slice(wordsBeforeBlank + 1),
  ].join(" ");
}

export function easyRomanisedWordForDisplay(
  exchange: ConversationExchange,
  selected: EasyWordOption | null,
  exchangeStep: "question" | "feedback" | "reply"
): string | null {
  if (exchangeStep === "question") {
    return selected?.romanised ?? null;
  }
  if (selected?.isCorrect) {
    return selected.romanised;
  }
  return exchange.easy_correct_word_romanised;
}
