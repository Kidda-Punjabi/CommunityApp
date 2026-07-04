import { synthesizeSpeech } from "@/lib/elevenlabs/server";
import {
  formatAudioReviewTitle,
  getAudioContentAdapter,
  type AudioContentContext,
} from "@/lib/audio/content-adapters";
import { loadAudioAsset } from "@/lib/audio/load-audio-asset";
import { bucketForContentType, publicUrlForAudioPath } from "@/lib/audio/storage";
import type { AudioAssetStatus, AudioContentType } from "@/lib/audio/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type GenerateAudioResult =
  | { ok: true; generationId: string; storagePath: string; audioAssetId: string }
  | { ok: false; error: string; skipped?: boolean };

type GenerateOptions = {
  scriptOverride?: string | null;
  force?: boolean;
  batchMode?: boolean;
};

function resolveScriptText(context: AudioContentContext, scriptOverride?: string | null): string {
  const fromOverride = scriptOverride?.trim();
  if (fromOverride) return fromOverride;
  return context.defaultScript.trim();
}

async function ensureAudioAssetRow(
  supabase: SupabaseClient,
  contentType: AudioContentType,
  contentId: string,
  scriptText: string
): Promise<{ id: string; status: AudioAssetStatus } | null> {
  const existing = await loadAudioAsset(supabase, contentType, contentId);
  if (existing) {
    return { id: existing.id, status: existing.status };
  }

  const { data, error } = await supabase
    .from("audio_assets")
    .insert({
      content_type: contentType,
      content_id: contentId,
      script_text: scriptText,
      status: "none",
    })
    .select("id, status")
    .single();

  if (error || !data) return null;
  return { id: data.id, status: data.status as AudioAssetStatus };
}

export async function generateContentAudio(
  supabase: SupabaseClient,
  contentType: AudioContentType,
  contentId: string,
  options: GenerateOptions = {}
): Promise<GenerateAudioResult> {
  const adapter = getAudioContentAdapter(contentType);
  const context = await adapter.loadContext(supabase, contentId);

  if (!context) {
    return { ok: false, error: "Content not found." };
  }

  const assetRow = await ensureAudioAssetRow(supabase, contentType, contentId, "");
  const status = assetRow?.status ?? "none";

  if (options.batchMode && !options.force && status !== "none") {
    return { ok: false, error: "Already in audio workflow.", skipped: true };
  }

  if (!options.force && status === "pending_review") {
    return {
      ok: false,
      error: "Audio is already pending review. Approve or reject it in the review queue first.",
    };
  }

  const scriptText = resolveScriptText(context, options.scriptOverride);
  if (!scriptText) {
    return { ok: false, error: "Add a script (Punjabi text) before generating." };
  }

  const bucket = bucketForContentType(contentType);
  const storagePath = adapter.storagePath(context);

  let audioBuffer: ArrayBuffer;
  try {
    audioBuffer = await synthesizeSpeech({ text: scriptText });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ElevenLabs request failed.";
    console.error(`[audio] TTS failed for ${contentType} ${contentId}:`, message);
    return { ok: false, error: message };
  }

  const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, audioBuffer, {
    contentType: "audio/mpeg",
    upsert: true,
  });

  if (uploadError) {
    console.error(`[audio] Upload failed for ${contentType} ${contentId}:`, uploadError.message);
    return { ok: false, error: `Storage upload failed: ${uploadError.message}` };
  }

  const asset =
    assetRow ??
    (await ensureAudioAssetRow(supabase, contentType, contentId, scriptText));
  if (!asset) {
    return { ok: false, error: "Failed to create audio asset record." };
  }

  const { data: generation, error: insertError } = await supabase
    .from("audio_generations")
    .insert({
      audio_asset_id: asset.id,
      script_text: scriptText,
      storage_path: storagePath,
      status: "pending_review",
    })
    .select("id")
    .single();

  if (insertError || !generation) {
    return {
      ok: false,
      error: insertError?.message ?? "Failed to save generation record.",
    };
  }

  const now = new Date().toISOString();
  const { error: assetError } = await supabase
    .from("audio_assets")
    .update({
      script_text: scriptText,
      storage_path: storagePath,
      status: "pending_review",
      updated_at: now,
    })
    .eq("id", asset.id);

  if (assetError) {
    return { ok: false, error: `Audio asset update failed: ${assetError.message}` };
  }

  await adapter.syncOnGenerate(supabase, context, scriptText, storagePath);

  return {
    ok: true,
    generationId: generation.id,
    storagePath,
    audioAssetId: asset.id,
  };
}

export function getPublicAudioUrl(
  supabaseUrl: string,
  contentType: AudioContentType,
  storagePath: string
): string {
  return publicUrlForAudioPath(supabaseUrl, bucketForContentType(contentType), storagePath);
}

/** @deprecated Use getPublicAudioUrl */
export function getPublicLessonAudioUrl(supabaseUrl: string, storagePath: string): string {
  return getPublicAudioUrl(supabaseUrl, "lesson", storagePath);
}

export async function approveContentAudio(
  supabase: SupabaseClient,
  contentType: AudioContentType,
  contentId: string,
  reviewerId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return { ok: false, error: "NEXT_PUBLIC_SUPABASE_URL is not set." };
  }

  const adapter = getAudioContentAdapter(contentType);
  const context = await adapter.loadContext(supabase, contentId);
  if (!context) {
    return { ok: false, error: "Content not found." };
  }

  const asset = await loadAudioAsset(supabase, contentType, contentId);
  if (!asset?.storage_path) {
    return { ok: false, error: "No pending audio to approve." };
  }

  const publicUrl = getPublicAudioUrl(supabaseUrl, contentType, asset.storage_path);
  const now = new Date().toISOString();

  const { error: generationError } = await supabase
    .from("audio_generations")
    .update({
      status: "approved",
      reviewed_by: reviewerId,
      reviewed_at: now,
    })
    .eq("audio_asset_id", asset.id)
    .eq("storage_path", asset.storage_path)
    .eq("status", "pending_review");

  if (generationError) {
    return { ok: false, error: generationError.message };
  }

  const { error: assetError } = await supabase
    .from("audio_assets")
    .update({
      audio_url: publicUrl,
      status: "approved",
      updated_at: now,
    })
    .eq("id", asset.id);

  if (assetError) {
    return { ok: false, error: assetError.message };
  }

  await adapter.syncOnApprove(supabase, context, publicUrl);

  return { ok: true };
}

export async function rejectContentAudio(
  supabase: SupabaseClient,
  contentType: AudioContentType,
  contentId: string,
  reviewerId: string,
  reviewNotes: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const notes = reviewNotes.trim();
  if (!notes) {
    return { ok: false, error: "Add review notes explaining what needs to change." };
  }

  const adapter = getAudioContentAdapter(contentType);
  const context = await adapter.loadContext(supabase, contentId);
  if (!context) {
    return { ok: false, error: "Content not found." };
  }

  const asset = await loadAudioAsset(supabase, contentType, contentId);
  if (!asset?.storage_path) {
    return { ok: false, error: "No pending audio to reject." };
  }

  const now = new Date().toISOString();

  const { error: generationError } = await supabase
    .from("audio_generations")
    .update({
      status: "rejected",
      review_notes: notes,
      reviewed_by: reviewerId,
      reviewed_at: now,
    })
    .eq("audio_asset_id", asset.id)
    .eq("storage_path", asset.storage_path)
    .eq("status", "pending_review");

  if (generationError) {
    return { ok: false, error: generationError.message };
  }

  const { error: assetError } = await supabase
    .from("audio_assets")
    .update({
      status: "needs_changes",
      review_notes: notes,
      reviewed_by: reviewerId,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", asset.id);

  if (assetError) {
    return { ok: false, error: assetError.message };
  }

  await adapter.syncOnReject(supabase, context);

  return { ok: true };
}

export async function updateContentAudioScript(
  supabase: SupabaseClient,
  contentType: AudioContentType,
  contentId: string,
  script: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = script.trim();
  if (!trimmed) {
    return { ok: false, error: "Audio script cannot be empty." };
  }

  const adapter = getAudioContentAdapter(contentType);
  const context = await adapter.loadContext(supabase, contentId);
  if (!context) {
    return { ok: false, error: "Content not found." };
  }

  const existing = await loadAudioAsset(supabase, contentType, contentId);
  const now = new Date().toISOString();

  if (existing) {
    const { error } = await supabase
      .from("audio_assets")
      .update({ script_text: trimmed, updated_at: now })
      .eq("id", existing.id);

    if (error) {
      return { ok: false, error: error.message };
    }
  } else {
    const { error } = await supabase.from("audio_assets").insert({
      content_type: contentType,
      content_id: contentId,
      script_text: trimmed,
      status: "none",
    });

    if (error) {
      return { ok: false, error: error.message };
    }
  }

  await adapter.syncScriptOnly(supabase, context, trimmed);

  return { ok: true };
}

export { formatAudioReviewTitle };

/** @deprecated Use generateContentAudio */
export async function generateLessonAudio(
  supabase: SupabaseClient,
  lessonId: string,
  options: GenerateOptions = {}
) {
  return generateContentAudio(supabase, "lesson", lessonId, options);
}

/** @deprecated Use approveContentAudio */
export async function approveLessonAudio(
  supabase: SupabaseClient,
  lessonId: string,
  reviewerId: string
) {
  return approveContentAudio(supabase, "lesson", lessonId, reviewerId);
}

/** @deprecated Use rejectContentAudio */
export async function rejectLessonAudio(
  supabase: SupabaseClient,
  lessonId: string,
  reviewerId: string,
  reviewNotes: string
) {
  return rejectContentAudio(supabase, "lesson", lessonId, reviewerId, reviewNotes);
}

/** @deprecated Use updateContentAudioScript */
export async function updateLessonAudioScript(
  supabase: SupabaseClient,
  lessonId: string,
  script: string
) {
  return updateContentAudioScript(supabase, "lesson", lessonId, script);
}
