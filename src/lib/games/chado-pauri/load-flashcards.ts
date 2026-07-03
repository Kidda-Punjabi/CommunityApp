import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChadoPauriFlashcard } from "./types";

type FlashcardRow = {
  id: string;
  front_text: string | null;
  back_text: string | null;
  romanised?: string | null;
  category: string | null;
  difficulty: number | null;
  topic_tags: string[] | null;
};

export type ChadoPauriFlashcardsLoadResult = {
  cards: ChadoPauriFlashcard[];
  loadError: string | null;
};

function normalizeCard(row: FlashcardRow): ChadoPauriFlashcard | null {
  const front_text = row.front_text?.trim() ?? "";
  const back_text = row.back_text?.trim() ?? "";
  if (!front_text || !back_text) return null;
  if (front_text === back_text) return null;

  return {
    id: row.id,
    front_text,
    back_text,
    romanised: row.romanised?.trim() || null,
    category: row.category,
    difficulty: row.difficulty ?? 1,
    topic_tags: Array.isArray(row.topic_tags) ? row.topic_tags.map(String) : [],
  };
}

export async function loadChadoPauriFlashcards(
  supabase: SupabaseClient
): Promise<ChadoPauriFlashcardsLoadResult> {
  const { data, error } = await supabase
    .from("flashcards")
    .select("id, front_text, back_text, romanised, category, difficulty, topic_tags")
    .order("created_at", { ascending: true });

  if (error) {
    return { cards: [], loadError: error.message };
  }

  const cards = (data ?? [])
    .map((row) => normalizeCard(row as FlashcardRow))
    .filter((card): card is ChadoPauriFlashcard => card !== null);

  return { cards, loadError: null };
}

export function countCardsByDifficulty(cards: ChadoPauriFlashcard[]): Record<number, number> {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const card of cards) {
    const tier = Math.min(5, Math.max(1, card.difficulty));
    counts[tier] = (counts[tier] ?? 0) + 1;
  }
  return counts;
}
