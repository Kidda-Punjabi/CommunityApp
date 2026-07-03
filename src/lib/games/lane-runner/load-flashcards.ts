import type { SupabaseClient } from "@supabase/supabase-js";
import type { LaneRunnerFlashcard } from "./types";

type FlashcardRow = {
  id: string;
  front_text: string | null;
  back_text: string | null;
  romanised: string | null;
  category: string | null;
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
  const { data, error } = await supabase
    .from("flashcards")
    .select("id, front_text, back_text, romanised, category")
    .order("created_at", { ascending: true });

  if (error) {
    return { cards: [], loadError: error.message };
  }

  const cards = (data ?? [])
    .map((row) => normalizeCard(row as FlashcardRow))
    .filter((card): card is LaneRunnerFlashcard => card !== null);

  return { cards, loadError: null };
}
