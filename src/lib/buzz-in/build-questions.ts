import type { SupabaseClient } from "@supabase/supabase-js";
import { pickRandomItems } from "@/lib/flashcards/utils";
import { buildMcqPayload, normalizeFlashcardRow } from "@/lib/group-games/build-mcq-question";
import type { BuzzInQuestionPayload } from "@/lib/buzz-in/types";

export type BuzzInRoundInsert = {
  round_number: number;
  question_payload: BuzzInQuestionPayload;
};

export async function buildBuzzInRounds(
  supabase: SupabaseClient,
  questionCount: number
): Promise<BuzzInRoundInsert[]> {
  const { data, error } = await supabase
    .from("flashcards")
    .select("id, front_text, back_text, category");

  if (error) throw error;

  const cards = (data ?? [])
    .map((row) => normalizeFlashcardRow(row))
    .filter((card): card is NonNullable<typeof card> => card !== null);

  if (cards.length < 4) {
    throw new Error("Not enough flashcards to build buzz-in questions (need at least 4).");
  }

  const picked = pickRandomItems(cards, Math.min(questionCount, cards.length));

  return picked.map((card, index) => ({
    round_number: index + 1,
    question_payload: buildMcqPayload(card, cards),
  }));
}
