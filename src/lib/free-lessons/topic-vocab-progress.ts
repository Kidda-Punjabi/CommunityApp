import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCommunityTopicCards } from "@/lib/free-lessons/load-topic-cards";
import { fetchFlashcardProgressMap } from "@/lib/progress/flashcard-progress";

export type TopicVocabProgress = {
  total: number;
  reviewed: number;
  /** Cards with 2+ Gurmukhi tokens — usable for sentence tile practice. */
  sentenceCapable: number;
};

function gurmukhiTokens(text: string): string[] {
  return text
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export async function loadTopicVocabProgress(
  supabase: SupabaseClient,
  userId: string,
  weekNumber: number
): Promise<TopicVocabProgress> {
  const { cards } = await loadCommunityTopicCards(supabase, weekNumber);
  if (cards.length === 0) {
    return { total: 0, reviewed: 0, sentenceCapable: 0 };
  }

  const progressMap = await fetchFlashcardProgressMap(
    supabase,
    userId,
    cards.map((card) => card.id)
  );
  const reviewed = cards.filter((card) => progressMap.has(card.id)).length;

  const sentenceCapable = cards.filter(
    (card) => gurmukhiTokens(card.back_text).length >= 2
  ).length;

  return {
    total: cards.length,
    reviewed,
    sentenceCapable,
  };
}
