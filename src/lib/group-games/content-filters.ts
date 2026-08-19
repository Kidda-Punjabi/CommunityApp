import type { GameRoomSettings, GroupGameType } from "@/lib/game-rooms/types";

export type GroupGameContentFilters = {
  topicTags: string[];
  difficultyMin: number | null;
  difficultyMax: number | null;
};

export const GROUP_GAMES_WITH_TOPIC_FILTER: ReadonlySet<GroupGameType> = new Set([
  "buzz_in",
  "jeopardy",
  "chado_pauri_group",
  "sentence_builder_group",
  "point_race",
]);

export const GROUP_GAMES_WITH_DIFFICULTY_FILTER: ReadonlySet<GroupGameType> = new Set([
  "buzz_in",
  "sentence_builder_group",
  "point_race",
]);

export function parseTopicTagsFromForm(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return [
      ...new Set(
        parsed
          .map((tag) => String(tag).trim().toLowerCase())
          .filter((tag) => tag.length > 0)
      ),
    ];
  } catch {
    return [];
  }
}

export function parseDifficultyBoundFromForm(
  raw: FormDataEntryValue | null,
  fallback: number
): number {
  const value = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(5, Math.max(1, value));
}

export function contentFiltersFromSettings(
  settings: GameRoomSettings | null | undefined
): GroupGameContentFilters {
  const topicTags = Array.isArray(settings?.topic_tags)
    ? [
        ...new Set(
          settings.topic_tags
            .map((tag) => String(tag).trim().toLowerCase())
            .filter((tag) => tag.length > 0)
        ),
      ]
    : [];

  const difficultyMin =
    typeof settings?.difficulty_min === "number" &&
    Number.isFinite(settings.difficulty_min)
      ? Math.min(5, Math.max(1, Math.round(settings.difficulty_min)))
      : null;
  const difficultyMax =
    typeof settings?.difficulty_max === "number" &&
    Number.isFinite(settings.difficulty_max)
      ? Math.min(5, Math.max(1, Math.round(settings.difficulty_max)))
      : null;

  if (
    difficultyMin !== null &&
    difficultyMax !== null &&
    difficultyMin > difficultyMax
  ) {
    return { topicTags, difficultyMin: difficultyMax, difficultyMax: difficultyMin };
  }

  return { topicTags, difficultyMin, difficultyMax };
}

export function buildRoomContentSettings(input: {
  questionCount: number;
  gameType: GroupGameType;
  topicTags: string[];
}): GameRoomSettings {
  const settings: GameRoomSettings = {
    question_count: input.questionCount,
  };

  if (
    GROUP_GAMES_WITH_TOPIC_FILTER.has(input.gameType) &&
    input.topicTags.length > 0
  ) {
    settings.topic_tags = input.topicTags;
  }

  // difficulty_min / difficulty_max intentionally omitted until content is
  // backfilled across levels 1–5 (helpers above remain for reinstatement).

  return settings;
}

/** Topic-only view of room settings — difficulty filters are ignored for now. */
export function topicFiltersFromSettings(
  settings: GameRoomSettings | null | undefined
): GroupGameContentFilters {
  const { topicTags } = contentFiltersFromSettings(settings);
  return { topicTags, difficultyMin: null, difficultyMax: null };
}

export function itemMatchesTopicTags(
  itemTags: string[] | null | undefined,
  selectedTags: string[]
): boolean {
  if (selectedTags.length === 0) return true;
  const normalized = new Set(
    (itemTags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean)
  );
  return selectedTags.some((tag) => normalized.has(tag));
}

export function itemMatchesDifficulty(
  difficulty: number | null | undefined,
  min: number | null,
  max: number | null
): boolean {
  if (min === null && max === null) return true;
  if (difficulty == null || !Number.isFinite(difficulty)) return false;
  const value = Math.round(difficulty);
  if (min !== null && value < min) return false;
  if (max !== null && value > max) return false;
  return true;
}

export function describeSelectedTopics(topicTags: string[]): string {
  if (topicTags.length === 0) return "the selected topic";
  const labels = topicTags.map(formatTopicTagLabel);
  if (labels.length === 1) return labels[0] ?? "the selected topic";
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, or ${labels[labels.length - 1]}`;
}

export function noQuestionsForTopicError(topicTags: string[]): Error {
  return new Error(
    `No questions for ${describeSelectedTopics(topicTags)}. Pick another topic, or leave topics unselected for a mixed pool.`
  );
}

export function filterByContentFilters<T>(
  items: T[],
  filters: GroupGameContentFilters,
  getTags: (item: T) => string[] | null | undefined,
  getDifficulty: (item: T) => number | null | undefined
): { matched: T[]; usedFallback: boolean } {
  const topicFiltered =
    filters.topicTags.length === 0
      ? items
      : items.filter((item) => itemMatchesTopicTags(getTags(item), filters.topicTags));

  if (filters.topicTags.length > 0 && topicFiltered.length === 0) {
    return { matched: [], usedFallback: false };
  }

  const difficultyFiltered =
    filters.difficultyMin === null && filters.difficultyMax === null
      ? topicFiltered
      : topicFiltered.filter((item) =>
          itemMatchesDifficulty(getDifficulty(item), filters.difficultyMin, filters.difficultyMax)
        );

  if (difficultyFiltered.length > 0) {
    return { matched: difficultyFiltered, usedFallback: false };
  }

  // Difficulty is a known content gap — if topics matched, keep the topic pool.
  if (topicFiltered.length > 0 && topicFiltered !== difficultyFiltered) {
    return { matched: topicFiltered, usedFallback: true };
  }

  return { matched: topicFiltered, usedFallback: false };
}

export function collectDistinctTopicTags(
  rows: Array<{ topic_tags?: string[] | null }>
): string[] {
  const tags = new Set<string>();
  for (const row of rows) {
    for (const tag of row.topic_tags ?? []) {
      const normalized = tag.trim().toLowerCase();
      if (normalized) tags.add(normalized);
    }
  }
  return [...tags].sort((a, b) => a.localeCompare(b));
}

export function formatTopicTagLabel(tag: string): string {
  return tag
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
