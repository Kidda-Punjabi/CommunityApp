import type { FlashcardDeckCard } from "@/lib/flashcards/types";
import {
  ACTIVITY_PASS_THRESHOLDS,
  ACTIVITY_QUESTION_COUNTS,
  TOPIC_MASTERY_MAX_LEVEL,
} from "@/lib/free-lessons/topic-visuals";

export type ActivityLevel = 0 | 1 | 2 | 3 | 4;

export type ActivityQuestion = {
  id: string;
  prompt: string;
  promptHint: string | null;
  options: string[];
  correctIndex: number;
  /** Show Gurmukhi answer after choosing (for learning). */
  reveal: string;
};

export type TopicActivity = {
  level: ActivityLevel;
  title: string;
  subtitle: string;
  passThreshold: number;
  questions: ActivityQuestion[];
};

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function uniqueOptions(correct: string, pool: string[], count: number): string[] {
  const others = shuffle(pool.filter((item) => item !== correct));
  return shuffle([correct, ...others.slice(0, Math.max(0, count - 1))]);
}

function activityMeta(level: ActivityLevel): { title: string; subtitle: string } {
  switch (level) {
    case 0:
      return {
        title: "Warm-up",
        subtitle: "Match the English meaning to the Punjabi phrase.",
      };
    case 1:
      return {
        title: "Practice",
        subtitle: "A little harder — more phrases, same idea.",
      };
    case 2:
      return {
        title: "Challenge",
        subtitle: "Now go the other way: Punjabi → English.",
      };
    case 3:
      return {
        title: "Stretch",
        subtitle: "Tougher mix — stay sharp.",
      };
    case 4:
      return {
        title: "Mastery check",
        subtitle: "Prove you’ve got this topic.",
      };
  }
}

/**
 * Build the next activity for a topic from its flashcard deck.
 * `masteryLevel` 0–4 = next activity to attempt; 5 = already mastered.
 */
export function buildTopicActivity(
  cards: FlashcardDeckCard[],
  masteryLevel: number
): TopicActivity | null {
  if (masteryLevel >= TOPIC_MASTERY_MAX_LEVEL) return null;
  if (cards.length < 2) return null;

  const level = Math.min(4, Math.max(0, masteryLevel)) as ActivityLevel;
  const questionCount = Math.min(
    ACTIVITY_QUESTION_COUNTS[level],
    cards.length
  );
  const optionCount = level >= 3 ? 4 : 3;
  const reverse = level >= 2;
  const pool = shuffle(cards).slice(0, Math.max(questionCount, optionCount + 1));
  const questionCards = shuffle(pool).slice(0, questionCount);

  const englishPool = cards.map((c) => c.front_text);
  const punjabiPool = cards.map((c) => c.back_text);

  const questions: ActivityQuestion[] = questionCards.map((card) => {
    if (reverse) {
      const options = uniqueOptions(card.front_text, englishPool, optionCount);
      return {
        id: `${card.id}-rev-${level}`,
        prompt: card.back_text,
        promptHint: card.romanised,
        options,
        correctIndex: options.indexOf(card.front_text),
        reveal: card.front_text,
      };
    }

    const options = uniqueOptions(card.back_text, punjabiPool, optionCount);
    return {
      id: `${card.id}-fwd-${level}`,
      prompt: card.front_text,
      promptHint: null,
      options,
      correctIndex: options.indexOf(card.back_text),
      reveal: card.back_text,
    };
  });

  const meta = activityMeta(level);
  return {
    level,
    ...meta,
    passThreshold: ACTIVITY_PASS_THRESHOLDS[level],
    questions,
  };
}

export function scoreActivity(
  answers: Array<{ correctIndex: number; chosenIndex: number }>
): { correct: number; total: number; percent: number; passed: boolean; passThreshold: number } {
  const total = answers.length;
  const correct = answers.filter((a) => a.chosenIndex === a.correctIndex).length;
  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
  // Caller supplies threshold from the activity; default 70 if unknown.
  return { correct, total, percent, passed: false, passThreshold: 70 };
}
