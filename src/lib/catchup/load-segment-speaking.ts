import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildSpeakingPracticePool,
  type SpeakingPracticeFlashcardRow,
} from "@/lib/games/speaking-practice";

/** Load speaking-practice cards from catch-up segment phrase_reference beats. */
export async function loadCatchupSegmentSpeakingCards(
  supabase: SupabaseClient,
  segmentId: string
) {
  const { data: beats, error: beatError } = await supabase
    .from("lesson_segment_beats")
    .select("source_content_id")
    .eq("segment_id", segmentId)
    .eq("beat_type", "phrase_reference")
    .eq("source_content_type", "flashcard")
    .order("beat_number", { ascending: true });

  if (beatError) throw beatError;

  const flashcardIds = (beats ?? [])
    .map((beat) => beat.source_content_id as string | null)
    .filter(Boolean) as string[];

  if (flashcardIds.length === 0) {
    return [];
  }

  const { data: cards, error: cardError } = await supabase
    .from("flashcards")
    .select("id, front_text, back_text, romanised, icon_name, difficulty")
    .in("id", flashcardIds);

  if (cardError) throw cardError;

  const byId = new Map((cards ?? []).map((card) => [card.id as string, card]));
  const ordered = flashcardIds
    .map((id) => byId.get(id))
    .filter(Boolean) as SpeakingPracticeFlashcardRow[];

  return buildSpeakingPracticePool(ordered);
}
