import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseVowelsTested,
  type VowelGameWord,
} from "@/lib/games/vowel-match";

export async function loadVowelMatchWords(
  supabase: SupabaseClient
): Promise<{ words: VowelGameWord[]; loadError: string | null }> {
  const { data, error } = await supabase
    .from("vowel_game_words")
    .select("id, word_gurmukhi, meaning_english, romanised, vowels_tested, audio_pa_url")
    .order("display_order", { ascending: true });

  if (error) {
    return { words: [], loadError: error.message };
  }

  const words: VowelGameWord[] = [];
  for (const row of data ?? []) {
    const audio = typeof row.audio_pa_url === "string" ? row.audio_pa_url.trim() : "";
    const vowels = parseVowelsTested(row.vowels_tested);
    if (!audio || vowels.length === 0) continue;
    words.push({
      id: row.id as string,
      word_gurmukhi: row.word_gurmukhi as string,
      meaning_english: row.meaning_english as string,
      romanised: row.romanised as string,
      vowels_tested: vowels,
      audio_pa_url: audio,
    });
  }

  return { words, loadError: null };
}
