import type { SupabaseClient } from "@supabase/supabase-js";
import { pickRandomItems } from "@/lib/flashcards/utils";
import type { BuzzInQuestionPayload } from "@/lib/buzz-in/types";
import {
  filterByContentFilters,
  topicFiltersFromSettings,
  type GroupGameContentFilters,
} from "@/lib/group-games/content-filters";
import { buildMcqPayload, normalizeFlashcardRow } from "@/lib/group-games/build-mcq-question";
import type { GameRoomSettings } from "@/lib/game-rooms/types";

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
};

export async function buildBuzzInRounds(
  supabase: SupabaseClient,
  questionCount: number,
  settings?: GameRoomSettings | null
): Promise<BuzzInRoundInsert[]> {
  const filters = topicFiltersFromSettings(settings);
  const { data, error } = await supabase
    .from("flashcards")
    .select("id, front_text, back_text, category, difficulty, topic_tags");

  if (error) throw error;

  const cards = ((data ?? []) as FlashcardPoolRow[])
    .map((row) => {
      const normalized = normalizeFlashcardRow(row);
      if (!normalized) return null;
      return {
        ...normalized,
        topic_tags: Array.isArray(row.topic_tags) ? row.topic_tags.map(String) : [],
      };
    })
    .filter((card): card is NonNullable<typeof card> => card !== null);

  if (cards.length < 4) {
    throw new Error("Not enough flashcards to build buzz-in questions (need at least 4).");
  }

  const { matched, usedFallback } = filterByContentFilters(
    cards,
    filters,
    (card) => card.topic_tags,
    (card) => card.difficulty
  );

  const pool = matched.length >= 4 ? matched : cards;
  if (matched.length < 4 && filters.topicTags.length > 0) {
    console.warn(
      "[buzz_in] Narrow content filter yielded too few cards; falling back to broader pool.",
      { filters, matched: matched.length, usedFallback }
    );
  }

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
