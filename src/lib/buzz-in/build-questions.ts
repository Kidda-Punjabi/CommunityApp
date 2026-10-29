import type { SupabaseClient } from "@supabase/supabase-js";
import type { BuzzInQuestionPayload } from "@/lib/buzz-in/types";
import {
  noQuestionsForTopicError,
  topicFiltersFromSettings,
  type GroupGameContentFilters,
} from "@/lib/group-games/content-filters";
import type { GameRoomSettings } from "@/lib/game-rooms/types";
import { cardsWithAnyTag, loadBuzzInCards } from "@/lib/buzz-in/load-topic-catalogue";
import { buildBuzzInQuestionSet, dedupeCards } from "@/lib/buzz-in/question-quality";
import { BUZZ_IN_MIN_QUESTIONS } from "@/lib/buzz-in/topic-catalogue";

export type BuzzInRoundInsert = {
  round_number: number;
  question_payload: BuzzInQuestionPayload;
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

  const allCards = await loadBuzzInCards(supabase, user.id);
  const topicCards = cardsWithAnyTag(allCards, filters.topicTags);

  if (dedupeCards(topicCards).length < BUZZ_IN_MIN_QUESTIONS) {
    // Rooms made with the old topic picker (no label) keep the old rules as a fallback.
    if (!settings?.topic_label) {
      const { buildLegacyBuzzInRounds } = await import("@/lib/buzz-in/build-questions-legacy");
      return buildLegacyBuzzInRounds(supabase, questionCount, settings);
    }
    if (filters.topicTags.length > 0) throw noQuestionsForTopicError(filters.topicTags);
    throw new Error("Not enough flashcards to build buzz-in questions (need at least 4).");
  }

  const questions = buildBuzzInQuestionSet(topicCards, allCards, questionCount);
  return questions.map((question_payload, index) => ({
    round_number: index + 1,
    question_payload,
  }));
}

export function buzzInFiltersFromSettings(
  settings?: GameRoomSettings | null
): GroupGameContentFilters {
  return topicFiltersFromSettings(settings);
}
