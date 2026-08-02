import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChadoPauriFlashcard } from "./types";
import { loadScopedFlashcardPoolRows } from "@/lib/games/load-scoped-flashcards";

type FlashcardRow = {
  id: string;
  front_text: string | null;
  back_text: string | null;
  romanised?: string | null;
  category: string | null;
  difficulty: number | null;
  topic_tags: string[] | null;
  lesson_id?: string | null;
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { cards: [], loadError: "Not signed in." };
  }

  const { rows, error } = await loadScopedFlashcardPoolRows<FlashcardRow>(
    supabase,
    user.id,
    "id, front_text, back_text, romanised, category, difficulty, topic_tags, lesson_id",
    { orderBy: { column: "created_at", ascending: true } }
  );

  if (error) {
    return { cards: [], loadError: error };
  }

  const cards = rows
    .map((row) => normalizeCard(row))
    .filter((card): card is ChadoPauriFlashcard => card !== null);

  return { cards, loadError: null };
}

export { countCardsByDifficulty } from "./difficulty-counts";
