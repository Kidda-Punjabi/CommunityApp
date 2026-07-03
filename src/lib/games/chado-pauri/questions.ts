import { shuffleArray, pickRandomItems } from "@/lib/flashcards/utils";
import { difficultyForRung } from "./config";
import type { ChadoPauriFlashcard, ChadoPauriOption, ChadoPauriQuestion } from "./types";

const MIN_POOL_SIZE = 4;

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
    const distractorPool = global.filter(
      (card) =>
        card.id !== questionCard.id &&
        card.back_text.trim().toLowerCase() !== questionCard.back_text.trim().toLowerCase()
    );
    const distractors = pickRandomItems(distractorPool, 3).map((card) => card.back_text);
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
  const distractorCards = pickRandomItems(
    eligible.filter(
      (card) =>
        card.id !== questionCard.id &&
        card.back_text.trim().toLowerCase() !== questionCard.back_text.trim().toLowerCase()
    ),
    Math.min(3, eligible.length - 1)
  );

  let distractorTexts = distractorCards.map((card) => card.back_text);
  if (distractorTexts.length < 3) {
    const extraPool = uniqueBackTexts(cards).filter(
      (card) =>
        card.id !== questionCard.id &&
        card.back_text.trim().toLowerCase() !== questionCard.back_text.trim().toLowerCase() &&
        !distractorTexts.some(
          (text) => text.trim().toLowerCase() === card.back_text.trim().toLowerCase()
        )
    );
    distractorTexts = [
      ...distractorTexts,
      ...pickRandomItems(extraPool, 3 - distractorTexts.length).map((card) => card.back_text),
    ];
  }

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
