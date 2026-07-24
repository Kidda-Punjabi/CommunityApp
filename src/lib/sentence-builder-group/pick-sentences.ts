import type { SupabaseClient } from "@supabase/supabase-js";
import { pickRandomItems } from "@/lib/flashcards/utils";
import {
  filterByContentFilters,
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
  supabase: SupabaseClient
): Promise<GrammarSentenceRow[]> {
  const { data, error } = await supabase
    .from("grammar_sentences")
    .select("id, punjabi_sentence, english_translation, word_tiles, difficulty, topic_tags");

  if (error) throw error;

  return (data ?? []).filter((row) => {
    const tiles = parseGrammarWordTiles(row.word_tiles);
    return tiles.length > 0;
  }) as GrammarSentenceRow[];
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
  const all = await loadGrammarSentencesForGroup(supabase);
  if (all.length === 0) {
    throw new Error("No grammar sentences with word tiles available.");
  }

  const filters = topicFiltersFromSettings(settings);
  const { matched, usedFallback } = filterByContentFilters(
    all,
    filters,
    (row) => row.topic_tags,
    (row) => row.difficulty
  );

  const pool = matched.length > 0 ? matched : all;
  if (matched.length === 0 && filters.topicTags.length > 0) {
    console.warn(
      "[sentence_builder_group] Narrow content filter matched nothing; falling back to full pool.",
      { filters, usedFallback }
    );
  }

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
