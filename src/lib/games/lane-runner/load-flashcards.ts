import type { SupabaseClient } from "@supabase/supabase-js";
import type { LaneRunnerFlashcard } from "./types";
import { loadScopedFlashcardPoolRows } from "@/lib/games/load-scoped-flashcards";

type FlashcardRow = {
  id: string;
  front_text: string | null;
  back_text: string | null;
  romanised: string | null;
  category: string | null;
  lesson_id?: string | null;
};

export type LaneRunnerFlashcardsLoadResult = {
  cards: LaneRunnerFlashcard[];
  loadError: string | null;
};

function normalizeCard(row: FlashcardRow): LaneRunnerFlashcard | null {
  const front_text = row.front_text?.trim() ?? "";
  const back_text = row.back_text?.trim() ?? "";
  if (!front_text || !back_text) return null;
  if (front_text === back_text) return null;

  return {
    id: row.id,
    front_text,
    back_text,
    romanised: row.romanised?.trim() || null,
    category: row.category?.trim() || null,
  };
}

export async function loadLaneRunnerFlashcards(
  supabase: SupabaseClient
): Promise<LaneRunnerFlashcardsLoadResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { cards: [], loadError: "Not signed in." };
  }

  const { rows, error } = await loadScopedFlashcardPoolRows<FlashcardRow>(
    supabase,
    user.id,
    "id, front_text, back_text, romanised, category, lesson_id",
    { orderBy: { column: "created_at", ascending: true } }
  );

  if (error) {
    return { cards: [], loadError: error };
  }

  const cards = rows
    .map((row) => normalizeCard(row))
    .filter((card): card is LaneRunnerFlashcard => card !== null);

  return { cards, loadError: null };
}
