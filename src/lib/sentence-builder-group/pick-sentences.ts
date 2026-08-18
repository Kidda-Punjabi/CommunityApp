import type { SupabaseClient } from "@supabase/supabase-js";
import { pickRandomItems } from "@/lib/flashcards/utils";
import {
  filterByContentFilters,
  noQuestionsForTopicError,
  topicFiltersFromSettings,
} from "@/lib/group-games/content-filters";
import {
  buildGroupSentenceTilePool,
  parseGrammarWordTiles,
  type GrammarWordTile,
} from "@/lib/sentence-builder-group/tiles";
import type { GameRoomSettings } from "@/lib/game-rooms/types";

export type GrammarSentenceRow = {
  id: string;
  punjabi_sentence: string;
  english_translation: string;
  word_tiles: unknown;
  difficulty: number | null;
  topic_tags: string[] | null;
};

export async function loadGrammarSentencesForGroup(
  supabase: SupabaseClient,
  topicTags: string[] = []
): Promise<GrammarSentenceRow[]> {
  const PAGE_SIZE = 1000;
  const rows: GrammarSentenceRow[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from("grammar_sentences")
      .select("id, punjabi_sentence, english_translation, word_tiles, difficulty, topic_tags");
    if (topicTags.length > 0) {
      query = query.overlaps("topic_tags", topicTags);
    }
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as GrammarSentenceRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows.filter((row) => {
    const tiles = parseGrammarWordTiles(row.word_tiles);
    return tiles.length > 0;
  });
}

export function parseSentenceWordTiles(row: GrammarSentenceRow): GrammarWordTile[] {
  return parseGrammarWordTiles(row.word_tiles);
}

export type PickedSentenceSession = {
  sentences: GrammarSentenceRow[];
  sessionSentenceIds: string[];
};

export async function pickSessionSentences(
  supabase: SupabaseClient,
  roundCount: number,
  settings?: GameRoomSettings | null
): Promise<PickedSentenceSession> {
  const filters = topicFiltersFromSettings(settings);
  const all = await loadGrammarSentencesForGroup(supabase, filters.topicTags);
  if (all.length === 0) {
    if (filters.topicTags.length > 0) {
      throw noQuestionsForTopicError(filters.topicTags);
    }
    throw new Error("No grammar sentences with word tiles available.");
  }

  const { matched } = filterByContentFilters(
    all,
    filters,
    (row) => row.topic_tags,
    (row) => row.difficulty
  );

  if (filters.topicTags.length > 0 && matched.length === 0) {
    throw noQuestionsForTopicError(filters.topicTags);
  }

  const pool = matched;

  const picked = pickRandomItems(pool, Math.min(roundCount, pool.length));
  return {
    sentences: picked,
    sessionSentenceIds: picked.map((s) => s.id),
  };
}

export function buildRoundPayload(sentence: GrammarSentenceRow, roundNumber: number) {
  const wordTiles = parseSentenceWordTiles(sentence);
  const tilePool = buildGroupSentenceTilePool(sentence.id, wordTiles);

  return {
    round_number: roundNumber,
    grammar_sentence_id: sentence.id,
    tile_pool: tilePool,
    english_translation: sentence.english_translation,
  };
}
