import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseDistractorLetters,
  type WordStartGameWord,
} from "@/lib/games/word-start";

export async function loadWordStartWords(
  supabase: SupabaseClient
): Promise<{ words: WordStartGameWord[]; loadError: string | null }> {
  const { data, error } = await supabase
    .from("word_start_game_words")
    .select(
      "id, word_gurmukhi, meaning_english, romanised, starting_letter, distractor_letters, audio_pa_url"
    )
    .order("display_order", { ascending: true });

  if (error) {
    return { words: [], loadError: error.message };
  }

  const words: WordStartGameWord[] = [];
  for (const row of data ?? []) {
    const audio = typeof row.audio_pa_url === "string" ? row.audio_pa_url.trim() : "";
    const starting = typeof row.starting_letter === "string" ? row.starting_letter.trim() : "";
    const distractors = parseDistractorLetters(row.distractor_letters);
    if (!audio || !starting || distractors.length < 2) continue;
    words.push({
      id: row.id as string,
      word_gurmukhi: row.word_gurmukhi as string,
      meaning_english: row.meaning_english as string,
      romanised: row.romanised as string,
      starting_letter: starting,
      distractor_letters: distractors,
      audio_pa_url: audio,
    });
  }

  return { words, loadError: null };
}
