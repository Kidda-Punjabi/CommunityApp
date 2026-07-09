import { PHOTO_TRANSLATE_MONTHLY_CAP_SCANS } from "@/lib/photo-translate/config";
import { currentMonthKeyUtc, nextMonthResetLabel } from "@/lib/photo-translate/month-key";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PhotoTranslateUsageSnapshot = {
  monthKey: string;
  scansUsed: number;
  scansRemaining: number;
  capScans: number;
  resetsOn: string;
};

type UsageRow = {
  scan_count: number;
};

export function usageSnapshotFromCount(
  scanCount: number,
  monthKey = currentMonthKeyUtc()
): PhotoTranslateUsageSnapshot {
  const safeUsed = Math.max(0, Math.floor(scanCount));
  return {
    monthKey,
    scansUsed: safeUsed,
    scansRemaining: Math.max(PHOTO_TRANSLATE_MONTHLY_CAP_SCANS - safeUsed, 0),
    capScans: PHOTO_TRANSLATE_MONTHLY_CAP_SCANS,
    resetsOn: nextMonthResetLabel(monthKey),
  };
}

export async function loadPhotoTranslateUsage(
  supabase: SupabaseClient,
  userId: string
): Promise<PhotoTranslateUsageSnapshot> {
  const monthKey = currentMonthKeyUtc();
  const { data, error } = await supabase
    .from("photo_translate_usage")
    .select("scan_count")
    .eq("user_id", userId)
    .eq("month_key", monthKey)
    .maybeSingle();

  if (error) {
    if (error.message.includes("photo_translate_usage")) {
      return usageSnapshotFromCount(0, monthKey);
    }
    throw new Error(error.message);
  }

  return usageSnapshotFromCount((data as UsageRow | null)?.scan_count ?? 0, monthKey);
}

export async function incrementPhotoTranslateUsage(
  supabase: SupabaseClient,
  userId: string
): Promise<PhotoTranslateUsageSnapshot> {
  const monthKey = currentMonthKeyUtc();

  const { data: existing, error: readError } = await supabase
    .from("photo_translate_usage")
    .select("scan_count")
    .eq("user_id", userId)
    .eq("month_key", monthKey)
    .maybeSingle();

  if (readError) {
    throw new Error(readError.message);
  }

  const nextCount = ((existing as UsageRow | null)?.scan_count ?? 0) + 1;

  const { error: writeError } = await supabase.from("photo_translate_usage").upsert(
    {
      user_id: userId,
      month_key: monthKey,
      scan_count: nextCount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,month_key" }
  );

  if (writeError) {
    throw new Error(writeError.message);
  }

  return usageSnapshotFromCount(nextCount, monthKey);
}

export function capReachedMessage(resetsOn: string): string {
  return `You've used all 25 Photo Translate scans for this month. Your allowance resets on ${resetsOn}.`;
}
