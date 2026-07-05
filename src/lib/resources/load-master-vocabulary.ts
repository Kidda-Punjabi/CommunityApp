import type { SupabaseClient } from "@supabase/supabase-js";
import {
  dedupeDictionaryEntries,
  isMasterVocabularyDeck,
  mapFlashcardToDictionaryEntry,
  MASTER_VOCABULARY_DECK_NAME,
  type DictionaryEntry,
} from "./dictionary";
import { loadDictionaryAudioByFlashcardId } from "./load-dictionary-audio";

const CARD_SELECT_WITH_EXAMPLES =
  "id, front_text, back_text, romanised, topic_tags, example_sentence_gurmukhi, example_sentence_romanised, example_sentence_english";

async function resolveMasterDeckId(supabase: SupabaseClient): Promise<string | null> {
  const { data: sets } = await supabase.from("flashcard_sets").select("id, name");
  const masterSet =
    sets?.find((set) => set.name === MASTER_VOCABULARY_DECK_NAME) ??
    sets?.find((set) => isMasterVocabularyDeck(set.name));
  return masterSet?.id ?? null;
}

export async function loadDictionaryEntryById(
  supabase: SupabaseClient,
  entryId: string
): Promise<DictionaryEntry | null> {
  const masterDeckId = await resolveMasterDeckId(supabase);
  if (!masterDeckId) return null;

  const { data: row, error } = await supabase
    .from("flashcards")
    .select(CARD_SELECT_WITH_EXAMPLES)
    .eq("id", entryId)
    .eq("deck_id", masterDeckId)
    .maybeSingle();

  if (error) throw error;
  if (!row) return null;

  const audioById = await loadDictionaryAudioByFlashcardId(supabase, [row.id]);
  return mapFlashcardToDictionaryEntry(row, audioById.get(row.id));
}

export async function loadMasterVocabularyDictionary(
  supabase: SupabaseClient
): Promise<{ entries: DictionaryEntry[]; deckFound: boolean; rawRowCount: number }> {
  const masterDeckId = await resolveMasterDeckId(supabase);

  if (!masterDeckId) {
    return { entries: [], deckFound: false, rawRowCount: 0 };
  }

  let cardRows: Parameters<typeof mapFlashcardToDictionaryEntry>[0][] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const withExamples = await supabase
      .from("flashcards")
      .select(CARD_SELECT_WITH_EXAMPLES)
      .eq("deck_id", masterDeckId)
      .order("front_text")
      .range(from, from + pageSize - 1);

    if (!withExamples.error) {
      cardRows.push(...(withExamples.data ?? []));
      if ((withExamples.data ?? []).length < pageSize) break;
      from += pageSize;
      continue;
    }

    if (withExamples.error.message.includes("example_sentence")) {
      const { data, error } = await supabase
        .from("flashcards")
        .select("id, front_text, back_text, romanised, topic_tags")
        .eq("deck_id", masterDeckId)
        .order("front_text")
        .range(from, from + pageSize - 1);
      if (error) throw error;
      cardRows.push(...(data ?? []));
      if ((data ?? []).length < pageSize) break;
      from += pageSize;
      continue;
    }

    throw withExamples.error;
  }

  const rows = cardRows;
  const audioById = await loadDictionaryAudioByFlashcardId(
    supabase,
    rows.map((row) => row.id)
  );

  return {
    entries: dedupeDictionaryEntries(
      rows.map((row) => mapFlashcardToDictionaryEntry(row, audioById.get(row.id)))
    ),
    deckFound: true,
    rawRowCount: rows.length,
  };
}
