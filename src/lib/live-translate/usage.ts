import {
  liveTranslateCapForPremium,
  liveTranslateCapMinutes,
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

export function usageSnapshotFromSeconds(
  secondsUsed: number,
  monthKey = currentMonthKeyUtc(),
  capSeconds = liveTranslateCapForPremium(false)
): LiveTranslateUsageSnapshot {
  const safeUsed = Math.max(0, Math.floor(secondsUsed));
  return {
    monthKey,
    secondsUsed: safeUsed,
    secondsRemaining: Math.max(capSeconds - safeUsed, 0),
    capSeconds,
    resetsOn: nextMonthResetLabel(monthKey),
  };
}

export async function loadLiveTranslateUsage(
  supabase: SupabaseClient,
  userId: string,
  isPremium = false
): Promise<LiveTranslateUsageSnapshot> {
  const monthKey = currentMonthKeyUtc();
  const capSeconds = liveTranslateCapForPremium(isPremium);
  const { data, error } = await supabase
    .from("live_translate_usage")
    .select("seconds_used")
    .eq("user_id", userId)
    .eq("month_key", monthKey)
    .maybeSingle();

  if (error) {
    if (error.message.includes("live_translate_usage")) {
      return usageSnapshotFromSeconds(0, monthKey, capSeconds);
    }
    throw new Error(error.message);
  }

  return usageSnapshotFromSeconds(
    (data as UsageRow | null)?.seconds_used ?? 0,
    monthKey,
    capSeconds
  );
}

export async function incrementLiveTranslateUsage(
  supabase: SupabaseClient,
  userId: string,
  durationSeconds: number,
  isPremium = false
): Promise<LiveTranslateUsageSnapshot> {
  const monthKey = currentMonthKeyUtc();
  const increment = Math.max(0, Math.ceil(durationSeconds));
  const capSeconds = liveTranslateCapForPremium(isPremium);

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

  return usageSnapshotFromSeconds(nextSeconds, monthKey, capSeconds);
}

export function capReachedMessage(resetsOn: string, capSeconds: number): string {
  const minutes = Math.round(capSeconds / 60);
  return `You've used your ${minutes} minutes of Live Translate for this month. Your allowance resets on ${resetsOn}.`;
}

export function liveTranslateCapLabel(isPremium: boolean): string {
  return `${liveTranslateCapMinutes(isPremium)} min/month`;
}
