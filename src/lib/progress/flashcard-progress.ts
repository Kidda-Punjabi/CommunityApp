import type { SupabaseClient } from "@supabase/supabase-js";
import {
  awardFlashcardConfidentPoints,
  tryAwardLessonCompletionPoints,
} from "@/lib/leaderboard/points";
import { learningProductForFlashcard } from "@/lib/learning/learning-product";

export type FlashcardConfidence = "confident" | "not_confident";

export type FlashcardProgressRow = {
  flashcard_id: string;
  confidence: FlashcardConfidence;
};

export type DeckConfidenceStats = {
  confident: number;
  notConfident: number;
  unrated: number;
  total: number;
};

export async function fetchFlashcardProgressMap(
  supabase: SupabaseClient,
  userId: string,
  flashcardIds?: string[]
): Promise<Map<string, FlashcardProgressRow>> {
  let query = supabase
    .from("flashcard_progress")
    .select("flashcard_id, confidence")
    .eq("user_id", userId);

  if (flashcardIds?.length) {
    query = query.in("flashcard_id", flashcardIds);
  }

  const { data } = await query;

  return new Map(
    (data ?? []).map((row) => [
      row.flashcard_id,
      { flashcard_id: row.flashcard_id, confidence: row.confidence as FlashcardConfidence },
    ])
  );
}

export type SaveFlashcardConfidenceResult = {
  flashcardPoints: number;
  lessonBonus: number;
};

export async function saveFlashcardConfidence(
  supabase: SupabaseClient,
  userId: string,
  flashcardId: string,
  confidence: FlashcardConfidence
): Promise<SaveFlashcardConfidenceResult> {
  const [{ data: existing }, { data: flashcard }] = await Promise.all([
    supabase
      .from("flashcard_progress")
      .select("confidence")
      .eq("user_id", userId)
      .eq("flashcard_id", flashcardId)
      .maybeSingle(),
    supabase.from("flashcards").select("lesson_id").eq("id", flashcardId).maybeSingle(),
  ]);

  const wasConfident = existing?.confidence === "confident";

  const { error } = await supabase.from("flashcard_progress").upsert(
    {
      user_id: userId,
      flashcard_id: flashcardId,
      confidence,
      last_reviewed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,flashcard_id" }
  );

  if (error) throw error;

  let flashcardPoints = 0;
  let lessonBonus = 0;

  if (confidence === "confident" && !wasConfident) {
    const product = await learningProductForFlashcard(supabase, flashcardId);
    flashcardPoints = await awardFlashcardConfidentPoints(
      supabase,
      undefined,
      product
    );
    if (flashcard?.lesson_id) {
      lessonBonus = await tryAwardLessonCompletionPoints(supabase, flashcard.lesson_id);
    }
  }

  return { flashcardPoints, lessonBonus };
}

export function computeDeckConfidenceStats(
  cardIds: string[],
  progressMap: Map<string, FlashcardProgressRow>
): DeckConfidenceStats {
  let confident = 0;
  let notConfident = 0;

  for (const id of cardIds) {
    const row = progressMap.get(id);
    if (row?.confidence === "confident") confident += 1;
    else if (row?.confidence === "not_confident") notConfident += 1;
  }

  return {
    confident,
    notConfident,
    unrated: cardIds.length - confident - notConfident,
    total: cardIds.length,
  };
}
