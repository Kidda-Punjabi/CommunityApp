import { shuffleArray, pickRandomItems } from "@/lib/flashcards/utils";
import { difficultyForRung } from "./config";
import type { ChadoPauriFlashcard, ChadoPauriOption, ChadoPauriQuestion } from "./types";

const MIN_POOL_SIZE = 4;

/** Word-class tags used to keep distractors the same part of speech. */
const WORD_TYPE_TAGS = new Set([
  "noun",
  "verb",
  "adjective",
  "adverb",
  "phrase",
  "connector",
  "question_word",
  "number",
  "pronoun",
  "postposition",
  "preposition",
]);

/** Metadata tags that should not drive semantic similarity. */
const META_TAG_PREFIXES = ["week_", "gender_", "lesson_"];

function poolsByDifficulty(cards: ChadoPauriFlashcard[]): Map<number, ChadoPauriFlashcard[]> {
  const pools = new Map<number, ChadoPauriFlashcard[]>();
  for (let tier = 1; tier <= 5; tier += 1) {
    pools.set(tier, []);
  }
  for (const card of cards) {
    const tier = Math.min(5, Math.max(1, card.difficulty));
    pools.get(tier)!.push(card);
  }
  return pools;
}

function difficultiesByDistance(target: number): number[] {
  const order: number[] = [];
  for (let distance = 0; distance <= 4; distance += 1) {
    for (const tier of [target - distance, target + distance]) {
      if (tier >= 1 && tier <= 5 && !order.includes(tier)) {
        order.push(tier);
      }
    }
  }
  return order;
}

export function resolveDifficultyPool(
  cards: ChadoPauriFlashcard[],
  targetDifficulty: number
): { pool: ChadoPauriFlashcard[]; actualDifficulty: number; usedFallback: boolean } {
  const pools = poolsByDifficulty(cards);

  for (const tier of difficultiesByDistance(targetDifficulty)) {
    const pool = pools.get(tier) ?? [];
    if (pool.length >= MIN_POOL_SIZE) {
      return {
        pool,
        actualDifficulty: tier,
        usedFallback: tier !== targetDifficulty,
      };
    }
  }

  const largest = [...pools.entries()]
    .filter(([, pool]) => pool.length > 0)
    .sort((a, b) => b[1].length - a[1].length)[0];

  if (!largest || largest[1].length < MIN_POOL_SIZE) {
    return { pool: [], actualDifficulty: targetDifficulty, usedFallback: true };
  }

  return {
    pool: largest[1],
    actualDifficulty: largest[0],
    usedFallback: largest[0] !== targetDifficulty,
  };
}

function uniqueBackTexts(cards: ChadoPauriFlashcard[]): ChadoPauriFlashcard[] {
  const seen = new Set<string>();
  const result: ChadoPauriFlashcard[] = [];
  for (const card of cards) {
    const key = card.back_text.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(card);
  }
  return result;
}

function normalizeTags(tags: string[]): string[] {
  return tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean);
}

export function wordTypeTags(tags: string[]): Set<string> {
  return new Set(normalizeTags(tags).filter((tag) => WORD_TYPE_TAGS.has(tag)));
}

export function topicalTags(tags: string[]): Set<string> {
  return new Set(
    normalizeTags(tags).filter(
      (tag) =>
        !WORD_TYPE_TAGS.has(tag) &&
        !META_TAG_PREFIXES.some((prefix) => tag.startsWith(prefix))
    )
  );
}

function sharesAny(a: Set<string>, b: Set<string>): boolean {
  for (const value of a) {
    if (b.has(value)) return true;
  }
  return false;
}

function isEligibleDistractor(
  candidate: ChadoPauriFlashcard,
  question: ChadoPauriFlashcard,
  alreadyPicked: string[]
): boolean {
  if (candidate.id === question.id) return false;
  const back = candidate.back_text.trim().toLowerCase();
  if (!back || back === question.back_text.trim().toLowerCase()) return false;
  if (alreadyPicked.some((text) => text.trim().toLowerCase() === back)) return false;
  return true;
}

/**
 * Prefer distractors that match word type, then topical tags, then category.
 * Falls back to the remaining pool so we still always fill 3 options when possible.
 */
export function pickDistractorTexts(
  question: ChadoPauriFlashcard,
  preferredPool: ChadoPauriFlashcard[],
  fallbackPool: ChadoPauriFlashcard[],
  count = 3
): string[] {
  const questionWordTypes = wordTypeTags(question.topic_tags);
  const questionTopics = topicalTags(question.topic_tags);
  const questionCategory = question.category?.trim().toLowerCase() || null;

  const picked: string[] = [];
  const usedIds = new Set<string>([question.id]);

  function takeFrom(candidates: ChadoPauriFlashcard[], needed: number) {
    if (needed <= 0) return;
    const eligible = candidates.filter(
      (card) =>
        !usedIds.has(card.id) && isEligibleDistractor(card, question, picked)
    );
    for (const card of pickRandomItems(eligible, needed)) {
      picked.push(card.back_text);
      usedIds.add(card.id);
    }
  }

  function hasConflictingWordType(card: ChadoPauriFlashcard): boolean {
    if (questionWordTypes.size === 0) return false;
    const cardWordTypes = wordTypeTags(card.topic_tags);
    if (cardWordTypes.size === 0) return false;
    return !sharesAny(questionWordTypes, cardWordTypes);
  }

  function partition(pool: ChadoPauriFlashcard[]) {
    const sameWordType: ChadoPauriFlashcard[] = [];
    const sameTopic: ChadoPauriFlashcard[] = [];
    const sameCategory: ChadoPauriFlashcard[] = [];
    const compatibleRemainder: ChadoPauriFlashcard[] = [];
    const conflicting: ChadoPauriFlashcard[] = [];

    for (const card of uniqueBackTexts(pool)) {
      if (!isEligibleDistractor(card, question, picked) || usedIds.has(card.id)) continue;

      const cardWordTypes = wordTypeTags(card.topic_tags);
      const cardTopics = topicalTags(card.topic_tags);
      const cardCategory = card.category?.trim().toLowerCase() || null;
      const conflictingType = hasConflictingWordType(card);

      if (questionWordTypes.size > 0 && sharesAny(questionWordTypes, cardWordTypes)) {
        sameWordType.push(card);
      } else if (
        !conflictingType &&
        questionTopics.size > 0 &&
        sharesAny(questionTopics, cardTopics)
      ) {
        sameTopic.push(card);
      } else if (!conflictingType && questionCategory && cardCategory === questionCategory) {
        sameCategory.push(card);
      } else if (!conflictingType) {
        compatibleRemainder.push(card);
      } else {
        conflicting.push(card);
      }
    }

    return { sameWordType, sameTopic, sameCategory, compatibleRemainder, conflicting };
  }

  for (const pool of [preferredPool, fallbackPool]) {
    if (picked.length >= count) break;
    const {
      sameWordType,
      sameTopic,
      sameCategory,
      compatibleRemainder,
      conflicting,
    } = partition(pool);
    takeFrom(sameWordType, count - picked.length);
    takeFrom(sameTopic, count - picked.length);
    takeFrom(sameCategory, count - picked.length);
    takeFrom(compatibleRemainder, count - picked.length);
    takeFrom(conflicting, count - picked.length);
  }

  return picked.slice(0, count);
}

export function buildChadoPauriQuestion(
  cards: ChadoPauriFlashcard[],
  rungIndex: number,
  excludeIds: Set<string> = new Set()
): ChadoPauriQuestion | null {
  const targetDifficulty = difficultyForRung(rungIndex);
  const { pool, actualDifficulty, usedFallback } = resolveDifficultyPool(
    cards,
    targetDifficulty
  );

  const eligible = uniqueBackTexts(
    pool.filter((card) => !excludeIds.has(card.id))
  );

  if (eligible.length < MIN_POOL_SIZE) {
    const global = uniqueBackTexts(cards.filter((card) => !excludeIds.has(card.id)));
    if (global.length < MIN_POOL_SIZE) return null;

    const questionCard = pickRandomItems(global, 1)[0];
    const distractors = pickDistractorTexts(questionCard, global, [], 3);
    const options = buildOptions(questionCard.back_text, distractors);

    return {
      flashcardId: questionCard.id,
      prompt: questionCard.front_text,
      correctAnswer: questionCard.back_text,
      options,
      targetDifficulty,
      actualDifficulty: questionCard.difficulty,
      usedDifficultyFallback: usedFallback || actualDifficulty !== targetDifficulty,
      category: questionCard.category,
      topic_tags: questionCard.topic_tags,
    };
  }

  const questionCard = pickRandomItems(eligible, 1)[0];
  const globalFallback = uniqueBackTexts(
    cards.filter((card) => !excludeIds.has(card.id))
  );
  const distractorTexts = pickDistractorTexts(
    questionCard,
    eligible,
    globalFallback,
    3
  );

  const options = buildOptions(questionCard.back_text, distractorTexts);

  return {
    flashcardId: questionCard.id,
    prompt: questionCard.front_text,
    correctAnswer: questionCard.back_text,
    options,
    targetDifficulty,
    actualDifficulty,
    usedDifficultyFallback: usedFallback,
    category: questionCard.category,
    topic_tags: questionCard.topic_tags,
  };
}

function buildOptions(correctAnswer: string, distractors: string[]): ChadoPauriOption[] {
  const uniqueDistractors = [...new Set(distractors.map((d) => d.trim()))].filter(
    (text) => text && text.toLowerCase() !== correctAnswer.trim().toLowerCase()
  );

  const options: ChadoPauriOption[] = [
    { key: "correct", text: correctAnswer, isCorrect: true },
    ...uniqueDistractors.slice(0, 3).map((text, index) => ({
      key: `distractor-${index}`,
      text,
      isCorrect: false,
    })),
  ];

  return shuffleArray(options).map((option, index) => ({
    ...option,
    key: `${option.key}-${index}`,
  }));
}

export function applyHalfAndHalf(options: ChadoPauriOption[]): ChadoPauriOption[] {
  const incorrect = options.filter((option) => !option.isCorrect);
  const correct = options.find((option) => option.isCorrect);
  if (!correct || incorrect.length < 2) return options;

  const keptIncorrect = pickRandomItems(incorrect, 1);
  return shuffleArray([correct, ...keptIncorrect]);
}
