import type { FlashcardDeckCard } from "@/lib/flashcards/types";
import {
  STAGE_ACTIVITY_PASS_THRESHOLDS,
  STAGE_ACTIVITY_QUESTION_COUNTS,
  STAGE_DEPTH_MAX,
  getStageMeta,
  type TopicStageId,
} from "@/lib/free-lessons/stages";

export type ActivityDepth = 0 | 1 | 2 | 3 | 4;

export type ActivityQuestion = {
  id: string;
  prompt: string;
  promptHint: string | null;
  options: string[];
  correctIndex: number;
  reveal: string;
};

export type TopicActivity = {
  stage: TopicStageId;
  depth: ActivityDepth;
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

function tokens(text: string): string[] {
  return text
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function depthMeta(
  stage: TopicStageId,
  depth: ActivityDepth
): { title: string; subtitle: string } {
  const stageMeta = getStageMeta(stage);
  const labels = [
    { title: "Warm-up", subtitle: "A gentle start — get familiar." },
    { title: "Practice", subtitle: "A little harder — more items." },
    { title: "Challenge", subtitle: "Switch direction and stay sharp." },
    { title: "Stretch", subtitle: "Tougher mix — fewer easy wins." },
    { title: "Stage check", subtitle: `Prove this ${stageMeta.label.toLowerCase()} stage.` },
  ] as const;
  return {
    title: `${stageMeta.label} · ${labels[depth].title}`,
    subtitle: labels[depth].subtitle,
  };
}

function buildVocabQuestions(
  cards: FlashcardDeckCard[],
  depth: ActivityDepth
): ActivityQuestion[] {
  const questionCount = Math.min(STAGE_ACTIVITY_QUESTION_COUNTS[depth], cards.length);
  const optionCount = depth >= 3 ? 4 : 3;
  const reverse = depth >= 2;
  const pool = shuffle(cards);
  const questionCards = pool.slice(0, questionCount);
  const englishPool = cards.map((c) => c.front_text);
  const punjabiPool = cards.map((c) => c.back_text);

  return questionCards.map((card) => {
    if (reverse) {
      const options = uniqueOptions(card.front_text, englishPool, optionCount);
      return {
        id: `${card.id}-vocab-rev-${depth}`,
        prompt: card.back_text,
        promptHint: card.romanised,
        options,
        correctIndex: options.indexOf(card.front_text),
        reveal: card.front_text,
      };
    }
    const options = uniqueOptions(card.back_text, punjabiPool, optionCount);
    return {
      id: `${card.id}-vocab-fwd-${depth}`,
      prompt: card.front_text,
      promptHint: null,
      options,
      correctIndex: options.indexOf(card.back_text),
      reveal: card.back_text,
    };
  });
}

function buildSentenceQuestions(
  cards: FlashcardDeckCard[],
  depth: ActivityDepth
): ActivityQuestion[] {
  const multi = cards.filter((card) => tokens(card.back_text).length >= 2);
  const source = multi.length >= 2 ? multi : cards;
  if (source.length < 2) return [];

  const questionCount = Math.min(STAGE_ACTIVITY_QUESTION_COUNTS[depth], source.length);
  const optionCount = depth >= 3 ? 4 : 3;
  const questionCards = shuffle(source).slice(0, questionCount);
  const phrasePool = source.map((c) => c.back_text);

  return questionCards.map((card) => {
    // Scrambled display as prompt — pick the correct full phrase.
    const parts = shuffle(tokens(card.back_text));
    const options = uniqueOptions(card.back_text, phrasePool, optionCount);
    return {
      id: `${card.id}-sent-${depth}`,
      prompt: `Build: ${card.front_text}`,
      promptHint: `Tiles: ${parts.join(" · ")}`,
      options,
      correctIndex: options.indexOf(card.back_text),
      reveal: card.back_text,
    };
  });
}

function buildConversationQuestions(
  cards: FlashcardDeckCard[],
  depth: ActivityDepth
): ActivityQuestion[] {
  if (cards.length < 2) return [];

  const questionCount = Math.min(STAGE_ACTIVITY_QUESTION_COUNTS[depth], cards.length);
  const optionCount = depth >= 3 ? 4 : 3;
  const questionCards = shuffle(cards).slice(0, questionCount);
  const replyPool = cards.map((c) => c.back_text);

  return questionCards.map((card, index) => {
    const askMode = depth >= 2 || index % 2 === 1;
    if (askMode) {
      const options = uniqueOptions(card.back_text, replyPool, optionCount);
      return {
        id: `${card.id}-ask-${depth}`,
        prompt: `How would you ask about: ${card.front_text}?`,
        promptHint: "Pick the Punjabi you’d say.",
        options,
        correctIndex: options.indexOf(card.back_text),
        reveal: card.back_text,
      };
    }

    const options = uniqueOptions(card.back_text, replyPool, optionCount);
    return {
      id: `${card.id}-reply-${depth}`,
      prompt: `Someone asks about “${card.front_text}”. What do you reply?`,
      promptHint: "Pick the best Punjabi response.",
      options,
      correctIndex: options.indexOf(card.back_text),
      reveal: card.back_text,
    };
  });
}

/**
 * Build the next activity for the learner’s current stage + depth.
 * `depth` 0–4 = next activity; 5 = stage already complete (caller should advance).
 */
export function buildTopicActivity(
  cards: FlashcardDeckCard[],
  stage: TopicStageId,
  depth: number
): TopicActivity | null {
  if (depth >= STAGE_DEPTH_MAX) return null;
  if (cards.length < 2) return null;

  const activityDepth = Math.min(4, Math.max(0, depth)) as ActivityDepth;
  let questions: ActivityQuestion[] = [];

  if (stage === 1) questions = buildVocabQuestions(cards, activityDepth);
  else if (stage === 2) questions = buildSentenceQuestions(cards, activityDepth);
  else questions = buildConversationQuestions(cards, activityDepth);

  if (questions.length === 0) return null;

  const meta = depthMeta(stage, activityDepth);
  return {
    stage,
    depth: activityDepth,
    ...meta,
    passThreshold: STAGE_ACTIVITY_PASS_THRESHOLDS[activityDepth],
    questions,
  };
}
