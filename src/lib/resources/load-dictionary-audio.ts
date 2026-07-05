import type { SupabaseClient } from "@supabase/supabase-js";
import type { DictionaryAudioLookup } from "./dictionary";

type ApprovedAudioRow = {
  content_type: string;
  content_id: string;
  audio_url: string | null;
};

/** Load approved dictionary audio URLs keyed by flashcard id. */
export async function loadDictionaryAudioByFlashcardId(
  supabase: SupabaseClient,
  flashcardIds: string[]
): Promise<Map<string, DictionaryAudioLookup>> {
  const map = new Map<string, DictionaryAudioLookup>();
  if (flashcardIds.length === 0) return map;

  const chunkSize = 200;
  for (let offset = 0; offset < flashcardIds.length; offset += chunkSize) {
    const chunk = flashcardIds.slice(offset, offset + chunkSize);
    const { data, error } = await supabase
      .from("audio_assets")
      .select("content_type, content_id, audio_url")
      .in("content_type", ["flashcard", "flashcard_example"])
      .in("content_id", chunk)
      .eq("status", "approved");

    if (error) throw error;

    for (const row of (data ?? []) as ApprovedAudioRow[]) {
      const url = row.audio_url?.trim() || null;
      if (!url) continue;

      const existing = map.get(row.content_id) ?? {
        wordAudioUrl: null,
        exampleAudioUrl: null,
      };

      if (row.content_type === "flashcard") {
        existing.wordAudioUrl = url;
      } else if (row.content_type === "flashcard_example") {
        existing.exampleAudioUrl = url;
      }

      map.set(row.content_id, existing);
    }
  }

  return map;
}
