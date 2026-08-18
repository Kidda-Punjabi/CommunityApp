import type { SupabaseClient } from "@supabase/supabase-js";
import { pickRandomItems } from "@/lib/flashcards/utils";
import type { BuzzInQuestionPayload } from "@/lib/buzz-in/types";
import {
  filterByContentFilters,
  noQuestionsForTopicError,
  topicFiltersFromSettings,
  type GroupGameContentFilters,
} from "@/lib/group-games/content-filters";
import { buildMcqPayload, normalizeFlashcardRow } from "@/lib/group-games/build-mcq-question";
import type { GameRoomSettings } from "@/lib/game-rooms/types";
import { loadScopedFlashcardPoolRows } from "@/lib/games/load-scoped-flashcards";

export type BuzzInRoundInsert = {
  round_number: number;
  question_payload: BuzzInQuestionPayload;
};

type FlashcardPoolRow = {
  id: string;
  front_text: string | null;
  back_text: string | null;
  category: string | null;
  difficulty: number | null;
  topic_tags: string[] | null;
  lesson_id?: string | null;
};

export async function buildBuzzInRounds(
  supabase: SupabaseClient,
  questionCount: number,
  settings?: GameRoomSettings | null
): Promise<BuzzInRoundInsert[]> {
  const filters = topicFiltersFromSettings(settings);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { rows, error } = await loadScopedFlashcardPoolRows<FlashcardPoolRow>(
    supabase,
    user.id,
    "id, front_text, back_text, romanised, category, difficulty, topic_tags, lesson_id",
    filters.topicTags.length > 0
      ? { overlaps: { topic_tags: filters.topicTags } }
      : undefined
  );

  if (error) throw new Error(error);

  const cards = rows
    .map((row) => {
      const normalized = normalizeFlashcardRow(row);
      if (!normalized) return null;
      return {
        ...normalized,
        topic_tags: Array.isArray(row.topic_tags) ? row.topic_tags.map(String) : [],
      };
    })
    .filter((card): card is NonNullable<typeof card> => card !== null);

  const { matched } = filterByContentFilters(
    cards,
    filters,
    (card) => card.topic_tags,
    (card) => card.difficulty
  );

  if (filters.topicTags.length > 0 && matched.length < 4) {
    throw noQuestionsForTopicError(filters.topicTags);
  }

  if (matched.length < 4) {
    throw new Error("Not enough flashcards to build buzz-in questions (need at least 4).");
  }

  const pool = matched;

  const picked = pickRandomItems(pool, Math.min(questionCount, pool.length));

  return picked.map((card, index) => ({
    round_number: index + 1,
    question_payload: buildMcqPayload(card, pool),
  }));
}

export function buzzInFiltersFromSettings(
  settings?: GameRoomSettings | null
): GroupGameContentFilters {
  return topicFiltersFromSettings(settings);
}
