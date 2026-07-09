import {
  LIVE_TRANSLATE_MONTHLY_CAP_SECONDS,
} from "@/lib/live-translate/config";
import { currentMonthKeyUtc, nextMonthResetLabel } from "@/lib/live-translate/month-key";
import type { SupabaseClient } from "@supabase/supabase-js";

export type LiveTranslateUsageSnapshot = {
  monthKey: string;
  secondsUsed: number;
  secondsRemaining: number;
  capSeconds: number;
  resetsOn: string;
};

type UsageRow = {
  seconds_used: number;
};

export function usageSnapshotFromSeconds(secondsUsed: number, monthKey = currentMonthKeyUtc()): LiveTranslateUsageSnapshot {
  const safeUsed = Math.max(0, Math.floor(secondsUsed));
  return {
    monthKey,
    secondsUsed: safeUsed,
    secondsRemaining: Math.max(LIVE_TRANSLATE_MONTHLY_CAP_SECONDS - safeUsed, 0),
    capSeconds: LIVE_TRANSLATE_MONTHLY_CAP_SECONDS,
    resetsOn: nextMonthResetLabel(monthKey),
  };
}

export async function loadLiveTranslateUsage(
  supabase: SupabaseClient,
  userId: string
): Promise<LiveTranslateUsageSnapshot> {
  const monthKey = currentMonthKeyUtc();
  const { data, error } = await supabase
    .from("live_translate_usage")
    .select("seconds_used")
    .eq("user_id", userId)
    .eq("month_key", monthKey)
    .maybeSingle();

  if (error) {
    if (error.message.includes("live_translate_usage")) {
      return usageSnapshotFromSeconds(0, monthKey);
    }
    throw new Error(error.message);
  }

  return usageSnapshotFromSeconds((data as UsageRow | null)?.seconds_used ?? 0, monthKey);
}

export async function incrementLiveTranslateUsage(
  supabase: SupabaseClient,
  userId: string,
  durationSeconds: number
): Promise<LiveTranslateUsageSnapshot> {
  const monthKey = currentMonthKeyUtc();
  const increment = Math.max(0, Math.ceil(durationSeconds));

  const { data: existing, error: readError } = await supabase
    .from("live_translate_usage")
    .select("seconds_used")
    .eq("user_id", userId)
    .eq("month_key", monthKey)
    .maybeSingle();

  if (readError) {
    throw new Error(readError.message);
  }

  const nextSeconds = ((existing as UsageRow | null)?.seconds_used ?? 0) + increment;

  const { error: writeError } = await supabase.from("live_translate_usage").upsert(
    {
      user_id: userId,
      month_key: monthKey,
      seconds_used: nextSeconds,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,month_key" }
  );

  if (writeError) {
    throw new Error(writeError.message);
  }

  return usageSnapshotFromSeconds(nextSeconds, monthKey);
}

export function capReachedMessage(resetsOn: string): string {
  return `You've used your 15 minutes of Live Translate for this month. Your allowance resets on ${resetsOn}.`;
}
