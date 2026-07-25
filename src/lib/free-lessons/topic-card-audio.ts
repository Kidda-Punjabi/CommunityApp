import type { SupabaseClient } from "@supabase/supabase-js";
import { loadDictionaryAudioByFlashcardId } from "@/lib/resources/load-dictionary-audio";

/** Strip romanisation / Latin tails from flashcard back text for TTS + audio lookup. */
export function gurmukhiScriptFromBack(backText: string): string {
  let text = backText.trim();
  text = text.replace(/\s*\([^)]*\)\s*$/u, "").trim();
  text = text.replace(/\s+[A-Za-z].*$/u, "").trim();
  return text.replace(/\s+/g, " ");
}

/**
 * Resolve approved flashcard audio for Everyday Punjabi topic cards.
 * Prefer assets linked by content_id; fall back to matching approved script_text.
 */
export async function loadTopicCardAudioUrls(
  supabase: SupabaseClient,
  cards: Array<{ id: string; back_text: string }>
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (cards.length === 0) return result;

  const byId = await loadDictionaryAudioByFlashcardId(
    supabase,
    cards.map((card) => card.id)
  );

  for (const card of cards) {
    const url = byId.get(card.id)?.wordAudioUrl?.trim();
    if (url) result.set(card.id, url);
  }

  const missing = cards.filter((card) => !result.has(card.id));
  if (missing.length === 0) return result;

  const scripts = [
    ...new Set(
      missing
        .map((card) => gurmukhiScriptFromBack(card.back_text))
        .filter((script) => script.length > 0)
    ),
  ];

  const byScript = new Map<string, string>();
  const chunkSize = 80;
  for (let offset = 0; offset < scripts.length; offset += chunkSize) {
    const chunk = scripts.slice(offset, offset + chunkSize);
    const { data, error } = await supabase
      .from("audio_assets")
      .select("script_text, audio_url")
      .eq("content_type", "flashcard")
      .eq("status", "approved")
      .in("script_text", chunk);

    if (error) throw error;

    for (const row of data ?? []) {
      const script = (row.script_text ?? "").trim().replace(/\s+/g, " ");
      const url = row.audio_url?.trim();
      if (!script || !url || byScript.has(script)) continue;
      byScript.set(script, url);
    }
  }

  for (const card of missing) {
    const script = gurmukhiScriptFromBack(card.back_text);
    const url = byScript.get(script);
    if (url) result.set(card.id, url);
  }

  return result;
}
