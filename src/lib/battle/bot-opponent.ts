import type { BattleQuestionPayload } from "@/lib/battle/types";

export const BATTLE_BOT_DISPLAY_NAME = "Computer";

export function initialBotSkill(learnerLevel: number | null): number {
  const level = Math.max(1, learnerLevel ?? 1);
  return Math.min(0.82, Math.max(0.38, 0.38 + level * 0.04));
}

export function adaptBotSkill(currentSkill: number, playerWasCorrect: boolean): number {
  const delta = playerWasCorrect ? 0.05 : -0.07;
  return Math.min(0.9, Math.max(0.28, currentSkill + delta));
}

export function botResponseDelayMs(skill: number): number {
  const base = 2500 + (1 - skill) * 6500;
  const jitter = Math.random() * 1800;
  return Math.round(base + jitter);
}

function pickWrongGenderSortAnswer(question: Extract<BattleQuestionPayload, { type: "gender_sort" }>) {
  return question.correctAnswer === "masculine" ? "feminine" : "masculine";
}

function pickWrongConjugationAnswer(
  question: Extract<BattleQuestionPayload, { type: "conjugation_challenge" }>
) {
  const wrong = question.options.find((option) => option.gurmukhi !== question.correctAnswer);
  return wrong?.gurmukhi ?? question.options[0]?.gurmukhi ?? question.correctAnswer;
}

export function decideBotAnswer(
  question: BattleQuestionPayload,
  skill: number
): { answer: string; correct: boolean } {
  const willAnswerCorrectly = Math.random() < skill;

  if (question.type === "gender_sort") {
    if (willAnswerCorrectly) {
      return { answer: question.correctAnswer, correct: true };
    }
    const wrong = pickWrongGenderSortAnswer(question);
    return { answer: wrong, correct: false };
  }

  if (willAnswerCorrectly) {
    return { answer: question.correctAnswer, correct: true };
  }

  const wrong = pickWrongConjugationAnswer(question);
  return { answer: wrong, correct: wrong === question.correctAnswer };
}
