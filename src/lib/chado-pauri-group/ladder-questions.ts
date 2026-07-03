import {
  applyHalfAndHalf,
  buildChadoPauriQuestion,
} from "@/lib/games/chado-pauri/questions";
import type {
  ChadoPauriFlashcard,
  ChadoPauriOption,
  ChadoPauriQuestion,
} from "@/lib/games/chado-pauri/types";
import { buildTutorHint } from "@/lib/games/chado-pauri/hints";

export type LadderQuestionPayload = {
  flashcard_id: string;
  prompt: string;
  correct_answer: string;
  options: string[];
  category: string | null;
  topic_tags: string[];
};

export function chadoPauriQuestionToPayload(
  question: ChadoPauriQuestion
): LadderQuestionPayload {
  return {
    flashcard_id: question.flashcardId,
    prompt: question.prompt,
    correct_answer: question.correctAnswer,
    options: question.options.map((o) => o.text),
    category: question.category,
    topic_tags: question.topic_tags,
  };
}

export function payloadToChadoPauriQuestion(
  payload: LadderQuestionPayload
): ChadoPauriQuestion {
  return {
    flashcardId: payload.flashcard_id,
    prompt: payload.prompt,
    correctAnswer: payload.correct_answer,
    options: payload.options.map((text, index) => ({
      key: `opt-${index}`,
      text,
      isCorrect: text === payload.correct_answer,
    })),
    targetDifficulty: 1,
    actualDifficulty: 1,
    usedDifficultyFallback: false,
    category: payload.category,
    topic_tags: payload.topic_tags ?? [],
  };
}

export function buildLadderQuestion(
  cards: ChadoPauriFlashcard[],
  rungIndex: number,
  excludeIds: Set<string> = new Set()
): LadderQuestionPayload | null {
  const question = buildChadoPauriQuestion(cards, rungIndex, excludeIds);
  if (!question) return null;
  return chadoPauriQuestionToPayload(question);
}

export function computeHalfAndHalfEliminated(
  payload: LadderQuestionPayload
): string[] {
  const options: ChadoPauriOption[] = payload.options.map((text, index) => ({
    key: `opt-${index}`,
    text,
    isCorrect: text === payload.correct_answer,
  }));
  const remaining = applyHalfAndHalf(options);
  const remainingTexts = new Set(remaining.map((o) => o.text));
  return payload.options.filter((text) => !remainingTexts.has(text));
}

export function buildLadderTutorHint(payload: LadderQuestionPayload): string {
  return buildTutorHint(payloadToChadoPauriQuestion(payload));
}

export { buildTutorHint };
