import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeGrammarSentence } from "@/lib/games/grammar-sentence";
import type { GrammarSentence } from "@/lib/games/types";

export type GrammarSentencesLoadResult = {
  sentences: GrammarSentence[];
  tableReady: boolean;
  loadError: string | null;
};

function isMissingGrammarSentencesTable(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("grammar_sentences") && lower.includes("does not exist");
}

export async function loadGrammarSentencesForGames(
  supabase: SupabaseClient
): Promise<GrammarSentencesLoadResult> {
  const { data, error } = await supabase
    .from("grammar_sentences")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingGrammarSentencesTable(error.message)) {
      return { sentences: [], tableReady: false, loadError: null };
    }
    return { sentences: [], tableReady: true, loadError: error.message };
  }

  return {
    sentences: (data ?? []).map((row) =>
      normalizeGrammarSentence(row as Record<string, unknown>)
    ),
    tableReady: true,
    loadError: null,
  };
}
