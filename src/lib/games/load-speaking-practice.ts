import {
  attemptsFromCount,
  currentMonthKeyUtc,
  type SpeakingPracticeAttempts,
  type SpeakingPracticeFlashcardRow,
  buildSpeakingPracticePool,
} from "@/lib/games/speaking-practice";
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
    supabase
      .from("flashcards")
      .select("id, front_text, back_text, romanised, icon_name, difficulty")
      .eq("category", "vocab"),
    supabase
      .from("speaking_practice_attempts")
      .select("attempt_count")
      .eq("user_id", userId)
      .eq("month_key", monthKey)
      .maybeSingle(),
  ]);

  if (cardsResult.error) {
    const message = cardsResult.error.message ?? "Failed to load vocabulary.";
    const missingTable = message.includes("flashcards");
    return {
      cards: [],
      attempts: attemptsFromCount(0),
      tableReady: !missingTable,
      loadError: message,
    };
  }

  const rows = (cardsResult.data ?? []) as SpeakingPracticeFlashcardRow[];
  const cards = buildSpeakingPracticePool(rows);

  const attemptCount = attemptsResult.error ? 0 : (attemptsResult.data?.attempt_count ?? 0);

  return {
    cards,
    attempts: attemptsFromCount(attemptCount),
    tableReady: true,
    loadError: cards.length === 0 ? "No vocabulary cards with romanisation are available yet." : null,
  };
}
