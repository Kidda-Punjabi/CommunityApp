import type { FlashcardDeckCard } from "@/lib/flashcards/types";
import {
  STAGE_ACTIVITY_PASS_THRESHOLDS,
  STAGE_ACTIVITY_QUESTION_COUNTS,
  STAGE_DEPTH_MAX,
  getStageMeta,
  type TopicStageId,
} from "@/lib/free-lessons/stages";
import {
  buildRomanisationLookup,
  cardPunjabiDisplay,
  containsGurmukhi,
  stripTrailingRomanisation,
} from "@/lib/free-lessons/topic-game-utils";

export type ActivityDepth = 0 | 1 | 2 | 3 | 4;

export type ActivityOption = {
  text: string;
  romanised: string | null;
};

export type ActivityQuestion = {
  id: string;
  prompt: string;
  promptHint: string | null;
  options: ActivityOption[];
  correctIndex: number;
  reveal: string;
  revealRomanised: string | null;
  /** Approved Punjabi TTS for this item when available. */
  audioUrl: string | null;
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

function uniqueOptionTexts(correct: string, pool: string[], count: number): string[] {
  const others = shuffle(pool.filter((item) => item !== correct));
  return shuffle([correct, ...others.slice(0, Math.max(0, count - 1))]);
}

function toOptions(
  texts: string[],
  romanisationByText: Map<string, string>
): ActivityOption[] {
  return texts.map((text) => ({
    text,
    romanised: containsGurmukhi(text)
      ? romanisationByText.get(text) ??
        stripTrailingRomanisation(text).romanised
      : null,
  }));
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
  const punjabiPool = cards.map((c) => cardPunjabiDisplay(c).gurmukhi);
  const romanisationByText = buildRomanisationLookup(cards);

  return questionCards.map((card) => {
    const audioUrl = card.audioUrl?.trim() || null;
    const { gurmukhi, romanised } = cardPunjabiDisplay(card);
    if (reverse) {
      const texts = uniqueOptionTexts(card.front_text, englishPool, optionCount);
      return {
        id: `${card.id}-vocab-rev-${depth}`,
        prompt: gurmukhi,
        promptHint: romanised || null,
        options: toOptions(texts, romanisationByText),
        correctIndex: texts.indexOf(card.front_text),
        reveal: card.front_text,
        revealRomanised: null,
        audioUrl,
      };
    }
    const texts = uniqueOptionTexts(gurmukhi, punjabiPool, optionCount);
    return {
      id: `${card.id}-vocab-fwd-${depth}`,
      prompt: card.front_text,
      promptHint: null,
      options: toOptions(texts, romanisationByText),
      correctIndex: texts.indexOf(gurmukhi),
      reveal: gurmukhi,
      revealRomanised: romanised || null,
      audioUrl,
    };
  });
}

function buildSentenceQuestions(
  cards: FlashcardDeckCard[],
  depth: ActivityDepth
): ActivityQuestion[] {
  const multi = cards.filter(
    (card) => tokens(cardPunjabiDisplay(card).gurmukhi).length >= 2
  );
  const source = multi.length >= 2 ? multi : cards;
  if (source.length < 2) return [];

  const questionCount = Math.min(STAGE_ACTIVITY_QUESTION_COUNTS[depth], source.length);
  const optionCount = depth >= 3 ? 4 : 3;
  const questionCards = shuffle(source).slice(0, questionCount);
  const phrasePool = source.map((c) => cardPunjabiDisplay(c).gurmukhi);
  const romanisationByText = buildRomanisationLookup(source);

  return questionCards.map((card) => {
    const { gurmukhi, romanised } = cardPunjabiDisplay(card);
    const gTokens = tokens(gurmukhi);
    const rTokens = tokens(romanised);
    const paired = shuffle(
      gTokens.map((g, i) => ({
        g,
        r: rTokens.length === gTokens.length ? rTokens[i] : "",
      }))
    );
    const texts = uniqueOptionTexts(gurmukhi, phrasePool, optionCount);
    return {
      id: `${card.id}-sent-${depth}`,
      prompt: `Build: ${card.front_text}`,
      promptHint: `Tiles: ${paired
        .map((part) => (part.r ? `${part.g} (${part.r})` : part.g))
        .join(" · ")}`,
      options: toOptions(texts, romanisationByText),
      correctIndex: texts.indexOf(gurmukhi),
      reveal: gurmukhi,
      revealRomanised: romanised || null,
      audioUrl: card.audioUrl?.trim() || null,
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
  const replyPool = cards.map((c) => cardPunjabiDisplay(c).gurmukhi);
  const romanisationByText = buildRomanisationLookup(cards);

  return questionCards.map((card, index) => {
    const audioUrl = card.audioUrl?.trim() || null;
    const { gurmukhi, romanised } = cardPunjabiDisplay(card);
    const askMode = depth >= 2 || index % 2 === 1;
    const texts = uniqueOptionTexts(gurmukhi, replyPool, optionCount);
    const options = toOptions(texts, romanisationByText);
    const correctIndex = texts.indexOf(gurmukhi);
    if (askMode) {
      return {
        id: `${card.id}-ask-${depth}`,
        prompt: `How would you ask about: ${card.front_text}?`,
        promptHint: "Pick the Punjabi you’d say.",
        options,
        correctIndex,
        reveal: gurmukhi,
        revealRomanised: romanised || null,
        audioUrl,
      };
    }

    return {
      id: `${card.id}-reply-${depth}`,
      prompt: `Someone asks about “${card.front_text}”. What do you reply?`,
      promptHint: "Pick the best Punjabi response.",
      options,
      correctIndex,
      reveal: gurmukhi,
      revealRomanised: romanised || null,
      audioUrl,
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
