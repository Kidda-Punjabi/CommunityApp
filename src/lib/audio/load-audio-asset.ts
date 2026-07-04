import type { SupabaseClient } from "@supabase/supabase-js";
import type { AudioAsset, AudioContentType, AudioGeneration } from "@/lib/audio/types";

export async function loadAudioAsset(
  supabase: SupabaseClient,
  contentType: AudioContentType,
  contentId: string
): Promise<AudioAsset | null> {
  const { data, error } = await supabase
    .from("audio_assets")
    .select("*")
    .eq("content_type", contentType)
    .eq("content_id", contentId)
    .maybeSingle();

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("audio_assets")) return null;
    throw error;
  }

  return data as AudioAsset | null;
}

export async function loadAudioAssetsForContentIds(
  supabase: SupabaseClient,
  contentType: AudioContentType,
  contentIds: string[]
): Promise<Map<string, AudioAsset>> {
  if (contentIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("audio_assets")
    .select("*")
    .eq("content_type", contentType)
    .in("content_id", contentIds);

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("audio_assets")) return new Map();
    throw error;
  }

  return new Map(
    (data ?? []).map((row) => [row.content_id as string, row as AudioAsset])
  );
}

export async function loadGenerationsForAsset(
  supabase: SupabaseClient,
  audioAssetId: string
): Promise<AudioGeneration[]> {
  const { data, error } = await supabase
    .from("audio_generations")
    .select("*")
    .eq("audio_asset_id", audioAssetId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as AudioGeneration[];
}

export function approvedAudioUrlFromAsset(asset: AudioAsset | null | undefined): string | null {
  if (!asset || asset.status !== "approved") return null;
  return asset.audio_url?.trim() || null;
}

export function mergeLegacyLessonAudioStatus(
  asset: AudioAsset | null | undefined,
  legacyStatus?: string | null
): AudioAsset["status"] {
  if (asset?.status) return asset.status;
  if (
    legacyStatus === "pending_review" ||
    legacyStatus === "approved" ||
    legacyStatus === "needs_changes"
  ) {
    return legacyStatus;
  }
  return "none";
}
