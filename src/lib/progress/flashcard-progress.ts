import type { SupabaseClient } from "@supabase/supabase-js";

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

export async function saveFlashcardConfidence(
  supabase: SupabaseClient,
  userId: string,
  flashcardId: string,
  confidence: FlashcardConfidence
) {
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
