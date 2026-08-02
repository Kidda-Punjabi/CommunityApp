import { loadScopedFlashcardPoolRows } from "@/lib/games/load-scoped-flashcards";
import { loadDictionaryAudioByFlashcardId } from "@/lib/resources/load-dictionary-audio";
import {
  buildPictureMatchPool,
  type PictureMatchCard,
} from "@/components/games/PictureMatch/pictureMatchCards";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadPictureMatchCards(
  supabase: SupabaseClient,
  userId: string
): Promise<{ cards: PictureMatchCard[]; loadError: string | null }> {
  const { rows, error } = await loadScopedFlashcardPoolRows<{
    id: string;
    front_text: string | null;
    back_text: string | null;
    romanised: string | null;
    icon_name: string | null;
    difficulty: number | null;
    lesson_id: string | null;
  }>(
    supabase,
    userId,
    "id, front_text, back_text, romanised, icon_name, difficulty, lesson_id",
    { eq: { category: "vocab" } }
  );

  if (error) {
    return { cards: [], loadError: error };
  }

  const cards = buildPictureMatchPool(
    rows.map((row) => ({
      id: row.id,
      front_text: row.front_text ?? "",
      back_text: row.back_text ?? "",
      romanised: row.romanised,
      icon_name: row.icon_name,
      difficulty: row.difficulty,
    }))
  );
  try {
    const audioMap = await loadDictionaryAudioByFlashcardId(
      supabase,
      cards.map((card) => card.id)
    );
    return {
      cards: cards.map((card) => ({
        ...card,
        audioUrl: audioMap.get(card.id)?.wordAudioUrl ?? null,
      })),
      loadError: null,
    };
  } catch {
    return { cards, loadError: null };
  }
}
