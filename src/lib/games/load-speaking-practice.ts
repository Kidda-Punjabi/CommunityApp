import {
  attemptsFromCount,
  currentMonthKeyUtc,
  type SpeakingPracticeAttempts,
  type SpeakingPracticeFlashcardRow,
  buildSpeakingPracticePool,
} from "@/lib/games/speaking-practice";
import { loadScopedFlashcardPoolRows } from "@/lib/games/load-scoped-flashcards";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SpeakingPracticeLoadResult = {
  cards: ReturnType<typeof buildSpeakingPracticePool>;
  attempts: SpeakingPracticeAttempts;
  tableReady: boolean;
  loadError: string | null;
};

export async function loadSpeakingPracticeContent(
  supabase: SupabaseClient,
  userId: string
): Promise<SpeakingPracticeLoadResult> {
  const monthKey = currentMonthKeyUtc();

  const [cardsResult, attemptsResult] = await Promise.all([
    loadScopedFlashcardPoolRows<SpeakingPracticeFlashcardRow & { lesson_id?: string | null }>(
      supabase,
      userId,
      "id, front_text, back_text, romanised, icon_name, difficulty, lesson_id",
      { eq: { category: "vocab" } }
    ),
    supabase
      .from("speaking_practice_attempts")
      .select("attempt_count")
      .eq("user_id", userId)
      .eq("month_key", monthKey)
      .maybeSingle(),
  ]);

  if (cardsResult.error) {
    const message = cardsResult.error ?? "Failed to load vocabulary.";
    const missingTable = message.includes("flashcards");
    return {
      cards: [],
      attempts: attemptsFromCount(0),
      tableReady: !missingTable,
      loadError: message,
    };
  }

  const cards = buildSpeakingPracticePool(cardsResult.rows);

  const attemptCount = attemptsResult.error ? 0 : (attemptsResult.data?.attempt_count ?? 0);

  return {
    cards,
    attempts: attemptsFromCount(attemptCount),
    tableReady: true,
    loadError: cards.length === 0 ? "No vocabulary cards with romanisation are available yet." : null,
  };
}
