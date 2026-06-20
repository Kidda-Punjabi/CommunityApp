import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { FlashcardDeckCard } from "@/lib/flashcards/types";
import { loadAccessibleGameDecks } from "./load-game-decks";

/** All flashcard cards from accessible Foundational Course decks, merged. */
export async function loadFoundationalCourseCards(
  supabase: SupabaseClient,
  user: User
): Promise<{ cards: FlashcardDeckCard[]; deckCount: number }> {
  const decks = await loadAccessibleGameDecks(supabase, user);
  const foundationalDecks = decks.filter((deck) => deck.courseTier === "foundational");

  if (foundationalDecks.length === 0) {
    return { cards: [], deckCount: 0 };
  }

  const deckIds = foundationalDecks.map((deck) => deck.deckId);

  const { data: flashcards } = await supabase
    .from("flashcards")
    .select("id, lesson_id, deck_id, front_text, back_text, romanised")
    .in("deck_id", deckIds);

  const cards: FlashcardDeckCard[] = (flashcards ?? []).map((row) => ({
    id: row.id,
    front_text: row.front_text,
    back_text: row.back_text,
    deck_id: row.deck_id,
    deck_name: foundationalDecks.find((deck) => deck.deckId === row.deck_id)?.setName ?? "Foundational",
  }));

  return { cards, deckCount: foundationalDecks.length };
}
