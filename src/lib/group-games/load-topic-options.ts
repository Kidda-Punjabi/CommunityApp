import type { SupabaseClient } from "@supabase/supabase-js";
import {
  collectDistinctTopicTags,
  formatTopicTagLabel,
} from "@/lib/group-games/content-filters";
import type { GroupGameType } from "@/lib/game-rooms/types";
import { loadScopedFlashcardPoolRows } from "@/lib/games/load-scoped-flashcards";

export type TopicOption = {
  id: string;
  label: string;
};

export async function loadFlashcardTopicOptions(
  supabase: SupabaseClient
): Promise<TopicOption[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { rows, error } = await loadScopedFlashcardPoolRows<{
    topic_tags: string[] | null;
    lesson_id: string | null;
  }>(supabase, user.id, "topic_tags, lesson_id");

  if (error) throw new Error(error);
  return collectDistinctTopicTags(rows).map((tag) => ({
    id: tag,
    label: formatTopicTagLabel(tag),
  }));
}

export async function loadGrammarSentenceTopicOptions(
  supabase: SupabaseClient
): Promise<TopicOption[]> {
  const { data, error } = await supabase.from("grammar_sentences").select("topic_tags");
  if (error) throw error;
  return collectDistinctTopicTags(data ?? []).map((tag) => ({
    id: tag,
    label: formatTopicTagLabel(tag),
  }));
}

export async function loadTopicOptionsForGroupGame(
  supabase: SupabaseClient,
  gameType: GroupGameType
): Promise<TopicOption[]> {
  if (gameType === "sentence_builder_group") {
    return loadGrammarSentenceTopicOptions(supabase);
  }
  if (
    gameType === "buzz_in" ||
    gameType === "jeopardy" ||
    gameType === "point_race"
  ) {
    return loadFlashcardTopicOptions(supabase);
  }
  return [];
}
