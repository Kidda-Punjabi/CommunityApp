import { STICKER_CATALOG } from "@/lib/kids/constants";
import type { KidSticker } from "@/lib/kids/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export function pickRandomUnearnedSticker(earnedIcons: Set<string>) {
  const available = STICKER_CATALOG.filter((entry) => !earnedIcons.has(entry.icon));
  const pool = available.length > 0 ? available : STICKER_CATALOG;
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function awardKidSticker(
  supabase: SupabaseClient,
  kidProfileId: string
): Promise<KidSticker | null> {
  const { data: existing } = await supabase
    .from("kid_stickers")
    .select("sticker_icon")
    .eq("kid_profile_id", kidProfileId);

  const earnedIcons = new Set((existing ?? []).map((row) => row.sticker_icon));
  const pick = pickRandomUnearnedSticker(earnedIcons);

  const { data, error } = await supabase
    .from("kid_stickers")
    .insert({
      kid_profile_id: kidProfileId,
      sticker_icon: pick.icon,
      sticker_name: pick.name,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const retry = pickRandomUnearnedSticker(
        new Set([...earnedIcons, pick.icon])
      );
      const { data: retryData } = await supabase
        .from("kid_stickers")
        .insert({
          kid_profile_id: kidProfileId,
          sticker_icon: retry.icon,
          sticker_name: retry.name,
        })
        .select("*")
        .single();
      return (retryData as KidSticker) ?? null;
    }
    return null;
  }

  return data as KidSticker;
}

export async function logKidActivity(
  supabase: SupabaseClient,
  kidProfileId: string,
  activityType: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await supabase.from("kid_activity_log").insert({
    kid_profile_id: kidProfileId,
    activity_type: activityType,
    metadata,
  });
}
