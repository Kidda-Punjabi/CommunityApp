"use server";

import {
  computeStreakPresentation,
  mapStreakRowSnapshot,
  presentationToHomeStats,
} from "@/lib/progress/activity-date";
import { evaluateUserStreak } from "@/lib/progress/streak";
import { createClient } from "@/lib/supabase/server";

const STREAK_SELECT =
  "current_streak, longest_streak, last_activity_date, redemption_available, streak_broken_date, streak_before_break";

async function fetchStreakRow(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_streaks")
    .select(STREAK_SELECT)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** Read-only streak display using the user's local calendar date. */
export async function getStreakPresentation(today: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not signed in." as const };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    return { error: "Invalid activity date." as const };
  }

  try {
    const row = await fetchStreakRow(user.id);
    const presentation = computeStreakPresentation(
      row ? mapStreakRowSnapshot(row) : null,
      today
    );

    return presentationToHomeStats(presentation);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to load streak.",
    };
  }
}

/** Persist redemption / expiry only when gap >= 2. Never runs on yesterday (gap 1). */
export async function syncStreakState(today: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return;

  try {
    const row = await fetchStreakRow(user.id);
    const presentation = computeStreakPresentation(
      row ? mapStreakRowSnapshot(row) : null,
      today
    );

    if (presentation.day_gap != null && presentation.day_gap >= 2) {
      await evaluateUserStreak(supabase, user.id, today);
    }
  } catch {
    // Non-blocking background sync
  }
}
