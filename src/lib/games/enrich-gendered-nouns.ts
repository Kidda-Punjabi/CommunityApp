import { latinRomanised } from "@/lib/conjugation/romanised";
import type { GenderedNoun } from "@/lib/games/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const FLASHCARD_BATCH = 100;

async function loadRomanisedFromFlashcards(
  supabase: SupabaseClient,
  words: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!words.length) return map;

  for (let index = 0; index < words.length; index += FLASHCARD_BATCH) {
    const batch = words.slice(index, index + FLASHCARD_BATCH);
    const batchSet = new Set(batch);

    const [{ data: byBack }, { data: byFront }] = await Promise.all([
      supabase
        .from("flashcards")
        .select("front_text, back_text, romanised")
        .in("back_text", batch)
        .not("romanised", "is", null),
      supabase
        .from("flashcards")
        .select("front_text, back_text, romanised")
        .in("front_text", batch)
        .not("romanised", "is", null),
    ]);

    for (const row of [...(byBack ?? []), ...(byFront ?? [])]) {
      const latin = latinRomanised(row.romanised);
      if (!latin) continue;

      if (batchSet.has(row.back_text) && !map.has(row.back_text)) {
        map.set(row.back_text, latin);
      }
      if (batchSet.has(row.front_text) && !map.has(row.front_text)) {
        map.set(row.front_text, latin);
      }
    }
  }

  return map;
}

/** Normalize romanised text and fill gaps from matching flashcard rows. */
export async function enrichGenderedNounsRomanisation(
  supabase: SupabaseClient,
  nouns: GenderedNoun[]
): Promise<GenderedNoun[]> {
  const normalized = nouns.map((noun) => ({
    ...noun,
    romanised: latinRomanised(noun.romanised),
  }));

  const missingWords = [
    ...new Set(
      normalized.filter((noun) => !noun.romanised).map((noun) => noun.punjabi_word.trim())
    ),
  ].filter(Boolean);

  if (!missingWords.length) return normalized;

  const romanisedByWord = await loadRomanisedFromFlashcards(supabase, missingWords);
  if (!romanisedByWord.size) return normalized;

  return normalized.map((noun) => {
    if (noun.romanised) return noun;
    const fromFlashcard = romanisedByWord.get(noun.punjabi_word.trim());
    return fromFlashcard ? { ...noun, romanised: fromFlashcard } : noun;
  });
}
