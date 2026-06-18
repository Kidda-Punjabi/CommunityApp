import type { SupabaseClient } from "@supabase/supabase-js";
import { getLocalActivityDate } from "@/lib/progress/activity-date";

export type StreakResult = {
  current_streak: number;
  display_streak: number;
  longest_streak: number;
  redemption_available: boolean;
  streak_at_risk: boolean;
  streak_before_break: number | null;
  streak_rescued: boolean;
  redemption_expired: boolean;
  already_active_today: boolean;
};

function parseStreakResult(data: unknown): StreakResult {
  const row = (data ?? {}) as Record<string, unknown>;
  const current = Number(row.current_streak ?? 0);
  const display = Number(row.display_streak ?? current);

  return {
    current_streak: current,
    display_streak: display,
    longest_streak: Number(row.longest_streak ?? 0),
    redemption_available: Boolean(row.redemption_available),
    streak_at_risk: Boolean(row.streak_at_risk),
    streak_before_break:
      row.streak_before_break == null ? null : Number(row.streak_before_break),
    streak_rescued: Boolean(row.streak_rescued),
    redemption_expired: Boolean(row.redemption_expired),
    already_active_today: Boolean(row.already_active_today),
  };
}

export async function evaluateUserStreak(
  supabase: SupabaseClient,
  userId: string,
  today = getLocalActivityDate()
): Promise<StreakResult> {
  const { data, error } = await supabase.rpc("evaluate_user_streak", {
    p_user_id: userId,
    p_today: today,
  });

  if (error) throw error;
  return parseStreakResult(data);
}

export async function recordStreakActivity(
  supabase: SupabaseClient,
  userId: string,
  today = getLocalActivityDate()
): Promise<StreakResult> {
  const { data, error } = await supabase.rpc("update_user_streak", {
    p_user_id: userId,
    p_today: today,
  });

  if (error) throw error;
  return parseStreakResult(data);
}

/** @deprecated Use recordStreakActivity */
export async function updateUserStreak(supabase: SupabaseClient, userId: string) {
  return recordStreakActivity(supabase, userId);
}
