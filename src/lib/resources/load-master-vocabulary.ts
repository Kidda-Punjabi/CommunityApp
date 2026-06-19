import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isMasterVocabularyDeck,
  mapFlashcardToDictionaryEntry,
  MASTER_VOCABULARY_DECK_NAME,
  type DictionaryEntry,
} from "./dictionary";

const CARD_SELECT_WITH_ROMANISED =
  "id, front_text, back_text, romanised, topic_tags";
const CARD_SELECT_BASE = "id, front_text, back_text, topic_tags";

export async function loadMasterVocabularyDictionary(
  supabase: SupabaseClient
): Promise<{ entries: DictionaryEntry[]; deckFound: boolean }> {
  const { data: sets } = await supabase.from("flashcard_sets").select("id, name");

  const masterSet =
    sets?.find((set) => set.name === MASTER_VOCABULARY_DECK_NAME) ??
    sets?.find((set) => isMasterVocabularyDeck(set.name));

  if (!masterSet) {
    return { entries: [], deckFound: false };
  }

  let cardRows: Parameters<typeof mapFlashcardToDictionaryEntry>[0][] | null = null;

  const withRomanised = await supabase
    .from("flashcards")
    .select(CARD_SELECT_WITH_ROMANISED)
    .eq("deck_id", masterSet.id)
    .order("front_text");

  if (!withRomanised.error) {
    cardRows = withRomanised.data ?? [];
  } else if (withRomanised.error.message.includes("romanised")) {
    const fallback = await supabase
      .from("flashcards")
      .select(CARD_SELECT_BASE)
      .eq("deck_id", masterSet.id)
      .order("front_text");
    cardRows = fallback.data ?? [];
  } else {
    throw withRomanised.error;
  }

  return {
    entries: (cardRows ?? []).map(mapFlashcardToDictionaryEntry),
    deckFound: true,
  };
}
