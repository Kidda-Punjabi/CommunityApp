import type { SupabaseClient } from "@supabase/supabase-js";
import {
  collectDistinctTopicTags,
  formatTopicTagLabel,
} from "@/lib/group-games/content-filters";
import type { GroupGameType } from "@/lib/game-rooms/types";
import { loadScopedFlashcardPoolRows } from "@/lib/games/load-scoped-flashcards";
import { loadGrammarSentencesForGroup } from "@/lib/sentence-builder-group/pick-sentences";

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
  const rows = await loadGrammarSentencesForGroup(supabase);
  return collectDistinctTopicTags(rows).map((tag) => ({
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
