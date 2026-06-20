export type RoundResult = {
  prompt: string;
  promptRomanised?: string;
  /** When true, wrong-answer review cards hide prompt romanisation (e.g. Sentence Builder). */
  omitPromptRomanisedWhenIncorrect?: boolean;
  userAnswer: string;
  userAnswerRomanised?: string;
  correctAnswer: string;
  correctAnswerRomanised?: string;
  wasCorrect: boolean;
};

export function isRoundResult(value: unknown): value is RoundResult {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.prompt === "string" &&
    typeof record.userAnswer === "string" &&
    typeof record.correctAnswer === "string" &&
    typeof record.wasCorrect === "boolean"
  );
}

export function parseSessionLog(raw: unknown): RoundResult[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRoundResult);
}

export function encouragingScoreHeadline(correct: number, total: number): string {
  if (total <= 0) return "Round complete";

  const ratio = correct / total;
  const base = `${correct}/${total}`;

  if (ratio >= 1) return `${base} — perfect!`;
  if (ratio >= 0.8) return `${base} — nice work!`;
  if (ratio >= 0.5) return `${base} — good effort!`;
  return `${base} — keep practicing!`;
}

export function missedCount(sessionLog: RoundResult[]): number {
  return sessionLog.filter((entry) => !entry.wasCorrect).length;
}
