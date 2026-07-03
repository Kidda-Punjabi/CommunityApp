import type { SupabaseClient } from "@supabase/supabase-js";
import { pickRandomItems } from "@/lib/flashcards/utils";
import {
  buildGroupSentenceTilePool,
  parseGrammarWordTiles,
  type GrammarWordTile,
} from "@/lib/sentence-builder-group/tiles";

export type GrammarSentenceRow = {
  id: string;
  punjabi_sentence: string;
  english_translation: string;
  word_tiles: unknown;
  difficulty: number | null;
};

export async function loadGrammarSentencesForGroup(
  supabase: SupabaseClient
): Promise<GrammarSentenceRow[]> {
  const { data, error } = await supabase
    .from("grammar_sentences")
    .select("id, punjabi_sentence, english_translation, word_tiles, difficulty");

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
  roundCount: number
): Promise<PickedSentenceSession> {
  const all = await loadGrammarSentencesForGroup(supabase);
  if (all.length === 0) {
    throw new Error("No grammar sentences with word tiles available.");
  }

  const picked = pickRandomItems(all, Math.min(roundCount, all.length));
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
