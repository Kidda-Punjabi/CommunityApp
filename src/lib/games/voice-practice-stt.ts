import type { SupabaseClient } from "@supabase/supabase-js";
import { currentMonthKeyUtc } from "@/lib/live-translate/month-key";

/** Speak It monthly Scribe transcriptions — separate from Speaking Practice (also 60). */
export const VOICE_PRACTICE_MONTHLY_LIMIT = 60;

export type VoicePracticeAttempts = {
  monthKey: string;
  used: number;
  remaining: number;
  limit: number;
};

export function attemptsFromCount(used: number): VoicePracticeAttempts {
  const safeUsed = Math.max(0, used);
  return {
    monthKey: currentMonthKeyUtc(),
    used: safeUsed,
    remaining: Math.max(0, VOICE_PRACTICE_MONTHLY_LIMIT - safeUsed),
    limit: VOICE_PRACTICE_MONTHLY_LIMIT,
  };
}

export async function loadVoicePracticeAttempts(
  supabase: SupabaseClient,
  userId: string
): Promise<VoicePracticeAttempts> {
  const monthKey = currentMonthKeyUtc();
  const { data, error } = await supabase
    .from("voice_practice_attempts")
    .select("attempt_count")
    .eq("user_id", userId)
    .eq("month_key", monthKey)
    .maybeSingle();

  if (error) {
    return attemptsFromCount(0);
  }

  return attemptsFromCount(data?.attempt_count ?? 0);
}
