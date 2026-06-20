export const QUESTION_COUNT_OPTIONS = [10, 20, 30] as const;

export type QuestionCount = (typeof QUESTION_COUNT_OPTIONS)[number];

export type GameSessionSettingsChoice = {
  questionCount: QuestionCount;
  /** `["mixed"]` or `["all"]` = no filter; otherwise one or more filter ids. */
  filterIds: string[];
};

export function isMixedFilter(filter: string | string[]): boolean {
  if (Array.isArray(filter)) {
    return filter.length === 0 || filter.every((id) => id === "mixed" || id === "all");
  }
  return filter === "mixed" || filter === "all";
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Even coverage when count exceeds pool size — reshuffle at end of each pass. */
export function pickCycledPool<T>(pool: T[], count: number): T[] {
  if (pool.length === 0 || count <= 0) return [];

  const result: T[] = [];
  let shuffled = shuffle(pool);
  let index = 0;

  while (result.length < count) {
    if (index >= shuffled.length) {
      shuffled = shuffle(pool);
      index = 0;
    }
    result.push(shuffled[index]);
    index += 1;
  }

  return result;
}

export function repeatPoolWarning(
  poolSize: number,
  questionCount: number,
  unit: "sentence" | "noun" = "sentence"
): string | null {
  if (poolSize <= 0 || questionCount <= poolSize) return null;

  const label =
    unit === "noun"
      ? poolSize === 1
        ? "noun"
        : "nouns"
      : poolSize === 1
        ? "sentence"
        : "sentences";
  return `This topic only has ${poolSize} ${label} — you'll see some repeated.`;
}
