import {
  passedVoiceAttempt,
  speechSimilarityPercent,
  VOICE_PRACTICE_PASS_THRESHOLD,
} from "@/lib/games/voice-practice";
import type { GameSessionSettingsChoice } from "@/lib/games/session-settings";
import { pickCycledPool } from "@/lib/games/session-settings";

export { VOICE_PRACTICE_PASS_THRESHOLD as SPEAKING_PRACTICE_PASS_THRESHOLD };

export const SPEAKING_PRACTICE_MONTHLY_LIMIT = 60;

export type SpeakingPracticeCard = {
  id: string;
  english: string;
  punjabi: string;
  romanised: string;
  iconName: string | null;
  difficulty: number;
};

export type SpeakingPracticeAttempts = {
  monthKey: string;
  used: number;
  remaining: number;
  limit: number;
};

export type SpeakingPracticeRound = {
  cards: SpeakingPracticeCard[];
  requestedCount: number;
};

const GURMUKHI = /[\u0A00-\u0A7F]/;

export type SpeakingPracticeFlashcardRow = {
  id: string;
  front_text: string;
  back_text: string;
  romanised: string | null;
  icon_name: string | null;
  difficulty: number | null;
};

export function normalizeSpeakingPracticeCard(
  row: SpeakingPracticeFlashcardRow
): SpeakingPracticeCard | null {
  const front = row.front_text?.trim() ?? "";
  const back = row.back_text?.trim() ?? "";
  const romanised = row.romanised?.trim() ?? "";
  if (!front || !back || !romanised) return null;

  const frontIsPunjabi = GURMUKHI.test(front);
  const backIsPunjabi = GURMUKHI.test(back);

  let english: string;
  let punjabi: string;

  if (!frontIsPunjabi && backIsPunjabi) {
    english = front;
    punjabi = back;
  } else if (frontIsPunjabi && !backIsPunjabi) {
    punjabi = front;
    english = back;
  } else {
    return null;
  }

  return {
    id: row.id,
    english,
    punjabi,
    romanised,
    iconName: row.icon_name,
    difficulty: row.difficulty ?? 1,
  };
}

export function buildSpeakingPracticePool(
  rows: SpeakingPracticeFlashcardRow[]
): SpeakingPracticeCard[] {
  const seen = new Map<string, SpeakingPracticeCard>();

  for (const row of rows) {
    const card = normalizeSpeakingPracticeCard(row);
    if (!card) continue;

    const key = card.romanised.toLowerCase();
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, card);
    }
  }

  return [...seen.values()];
}

export function buildSpeakingPracticeRound(
  pool: SpeakingPracticeCard[],
  choice: GameSessionSettingsChoice
): SpeakingPracticeRound {
  const requestedCount = choice.questionCount;
  const cards = pickCycledPool(pool, Math.min(requestedCount, pool.length));

  return { cards, requestedCount };
}

export type SpeakingMatchTarget = {
  romanised: string;
  punjabi?: string;
};

/** Compare STT transcript against romanised and Gurmukhi targets; take the best score. */
export function matchSpeakingTranscript(
  transcript: string,
  target: string | SpeakingMatchTarget
): number {
  const romanised = typeof target === "string" ? target : target.romanised;
  const punjabi = typeof target === "string" ? undefined : target.punjabi;

  const scores = [speechSimilarityPercent(transcript, romanised)];
  if (punjabi?.trim()) {
    scores.push(speechSimilarityPercent(transcript, punjabi));
  }

  return Math.max(...scores);
}

export function passedSpeakingAttempt(similarity: number): boolean {
  return passedVoiceAttempt(similarity);
}

export function currentMonthKeyUtc(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function attemptsFromCount(attemptCount: number): SpeakingPracticeAttempts {
  const limit = SPEAKING_PRACTICE_MONTHLY_LIMIT;
  const used = Math.max(0, attemptCount);
  return {
    monthKey: currentMonthKeyUtc(),
    used,
    remaining: Math.max(0, limit - used),
    limit,
  };
}
