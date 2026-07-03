import type { SupabaseClient } from "@supabase/supabase-js";
import { pickRandomItems } from "@/lib/flashcards/utils";
import {
  buildMcqPayload,
  normalizeFlashcardRow,
  type FlashcardForMcq,
} from "@/lib/group-games/build-mcq-question";
import type { McqQuestionPayload } from "@/lib/group-games/buzz-race-types";

let flashcardPoolCache: FlashcardForMcq[] | null = null;

export async function loadFlashcardPool(supabase: SupabaseClient): Promise<FlashcardForMcq[]> {
  const { data, error } = await supabase
    .from("flashcards")
    .select("id, front_text, back_text, category");

  if (error) throw error;

  const cards = (data ?? [])
    .map((row) => normalizeFlashcardRow(row))
    .filter((card): card is NonNullable<typeof card> => card !== null);

  if (cards.length < 4) {
    throw new Error("Not enough flashcards to build point race questions (need at least 4).");
  }

  return cards;
}

export async function getFlashcardPool(supabase: SupabaseClient): Promise<FlashcardForMcq[]> {
  if (flashcardPoolCache && flashcardPoolCache.length >= 4) return flashcardPoolCache;
  flashcardPoolCache = await loadFlashcardPool(supabase);
  return flashcardPoolCache;
}

export function buildRandomMcqQuestion(cards: FlashcardForMcq[]): McqQuestionPayload {
  const card = pickRandomItems(cards, 1)[0]!;
  return buildMcqPayload(card, cards);
}

export async function buildInitialRaceQuestions(
  supabase: SupabaseClient,
  playerIds: string[]
): Promise<Array<{ player_id: string; current_question_payload: McqQuestionPayload }>> {
  const cards = await getFlashcardPool(supabase);

  return playerIds.map((player_id) => ({
    player_id,
    current_question_payload: buildRandomMcqQuestion(cards),
  }));
}
