import "server-only";

import type { KidAgeTier } from "@/lib/kids/constants";
import { FREE_KID_STORY_TASTE_COUNT } from "@/lib/kids/constants";
import { parentHasPremiumAccess } from "@/lib/membership/premium-access";
import type { SupabaseClient } from "@supabase/supabase-js";

export { FREE_KID_STORY_TASTE_COUNT };

export const BEDTIME_STORY_AUDIO_CONTENT_TYPE = "bedtime_story";

export type KidBedtimeStory = {
  id: string;
  title: string;
  audioAssetId: string | null;
  /** Only set when linked audio_assets.status = 'approved'. */
  playableAudioUrl: string | null;
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

type AssetRow = {
  id: string;
  status: string;
  audio_url: string | null;
};

function approvedUrlFromAsset(asset: AssetRow | undefined): string | null {
  if (!asset || asset.status !== "approved") return null;
  const url = asset.audio_url?.trim();
  return url || null;
}

function mapStory(
  row: StoryRow,
  parentIsPremium: boolean,
  playableAudioUrl: string | null
): KidBedtimeStory {
  const unlocked = parentIsPremium || !row.is_premium;
  return {
    id: row.id,
    title: row.title,
    audioAssetId: row.audio_asset_id,
    playableAudioUrl,
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

  const assetIds = [
    ...new Set(
      rows
        .map((row) => row.audio_asset_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const assetById = new Map<string, AssetRow>();
  if (assetIds.length > 0) {
    const { data: assets, error: assetsError } = await supabase
      .from("audio_assets")
      .select("id, status, audio_url")
      .eq("content_type", BEDTIME_STORY_AUDIO_CONTENT_TYPE)
      .in("id", assetIds);

    if (assetsError) {
      throw assetsError;
    }

    for (const asset of (assets ?? []) as AssetRow[]) {
      assetById.set(asset.id, asset);
    }
  }

  const mapped = rows.map((row) =>
    mapStory(
      row,
      parentIsPremium,
      row.audio_asset_id
        ? approvedUrlFromAsset(assetById.get(row.audio_asset_id))
        : null
    )
  );

  if (parentIsPremium) {
    return { stories: mapped, parentIsPremium, tableReady: true };
  }

  // Free taste: non-premium stories first, capped.
  const freeTaste = mapped.filter((story) => !story.isPremium).slice(0, FREE_KID_STORY_TASTE_COUNT);
  const lockedPremium = mapped
    .filter((story) => story.isPremium)
    .map((story) => ({ ...story, unlocked: false, playableAudioUrl: null }));

  return {
    stories: [...freeTaste, ...lockedPremium],
    parentIsPremium,
    tableReady: true,
  };
}
