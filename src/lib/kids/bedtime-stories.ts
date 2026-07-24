import "server-only";

import type { KidAgeTier } from "@/lib/kids/constants";
import { parentHasPremiumAccess } from "@/lib/membership/premium-access";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * PLACEHOLDER — free taste story count for parents without Premium.
 * Confirm final count with Gurupma.
 */
export const FREE_KID_STORY_TASTE_COUNT = 2;

export type KidBedtimeStory = {
  id: string;
  title: string;
  audioAssetId: string | null;
  ageTier: KidAgeTier | "all";
  isPremium: boolean;
  displayOrder: number;
  unlocked: boolean;
};

type StoryRow = {
  id: string;
  title: string;
  audio_asset_id: string | null;
  age_tier: string;
  is_premium: boolean;
  display_order: number;
};

function mapStory(row: StoryRow, parentIsPremium: boolean): KidBedtimeStory {
  const unlocked = parentIsPremium || !row.is_premium;
  return {
    id: row.id,
    title: row.title,
    audioAssetId: row.audio_asset_id,
    ageTier: row.age_tier as KidAgeTier | "all",
    isPremium: row.is_premium,
    displayOrder: row.display_order,
    unlocked,
  };
}

export async function loadKidBedtimeStoriesForParent(
  supabase: SupabaseClient,
  parentUserId: string,
  ageTier?: KidAgeTier | null
): Promise<{ stories: KidBedtimeStory[]; parentIsPremium: boolean; tableReady: boolean }> {
  const parentIsPremium = await parentHasPremiumAccess(supabase, parentUserId);

  const { data, error } = await supabase
    .from("kid_bedtime_stories")
    .select("id, title, audio_asset_id, age_tier, is_premium, display_order")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    if (error.message.includes("kid_bedtime_stories")) {
      return { stories: [], parentIsPremium, tableReady: false };
    }
    throw error;
  }

  let rows = (data ?? []) as StoryRow[];
  if (ageTier) {
    rows = rows.filter((row) => row.age_tier === "all" || row.age_tier === ageTier);
  }

  const mapped = rows.map((row) => mapStory(row, parentIsPremium));

  if (parentIsPremium) {
    return { stories: mapped, parentIsPremium, tableReady: true };
  }

  // Free taste: non-premium stories first, capped.
  const freeTaste = mapped.filter((story) => !story.isPremium).slice(0, FREE_KID_STORY_TASTE_COUNT);
  const lockedPremium = mapped
    .filter((story) => story.isPremium)
    .map((story) => ({ ...story, unlocked: false }));

  return {
    stories: [...freeTaste, ...lockedPremium],
    parentIsPremium,
    tableReady: true,
  };
}
