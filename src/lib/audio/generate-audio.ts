import { synthesizeSpeech } from "@/lib/elevenlabs/server";
import { getPronunciationDictionaryLocator } from "@/lib/elevenlabs/pronunciation-dictionary";
import { resolveVettedVoiceId } from "@/lib/elevenlabs/constants";
import {
  formatAudioReviewTitle,
  getAudioContentAdapter,
  type AudioContentContext,
} from "@/lib/audio/content-adapters";
import { loadAudioAsset, loadGenerationsForAsset } from "@/lib/audio/load-audio-asset";
import { bucketForContentType, publicUrlForAudioPath } from "@/lib/audio/storage";
import type { AudioAssetStatus, AudioContentType } from "@/lib/audio/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type GenerateAudioResult =
  | {
      ok: true;
      generationId: string;
      storagePath: string;
      audioAssetId: string;
      generationIds?: string[];
      variationCount?: number;
    }
  | { ok: false; error: string; skipped?: boolean };

type GenerateOptions = {
  scriptOverride?: string | null;
  force?: boolean;
  batchMode?: boolean;
  voiceId?: string;
  /** 1 = single clip (default). 2–3 = multi-take batch for reviewer to pick from. */
  variationCount?: number;
};

function resolveScriptText(context: AudioContentContext, scriptOverride?: string | null): string {
  const fromOverride = scriptOverride?.trim();
  if (fromOverride) return fromOverride;
  return context.defaultScript.trim();
}

function storagePathForTake(basePath: string, variationIndex: number): string {
  if (variationIndex <= 0) return basePath;
  return basePath.replace(/\.mp3$/i, `-take-${variationIndex + 1}.mp3`);
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

async function rejectPendingGenerations(
  supabase: SupabaseClient,
  audioAssetId: string,
  exceptGenerationId?: string
): Promise<void> {
  let query = supabase
    .from("audio_generations")
    .update({ status: "rejected", reviewed_at: new Date().toISOString() })
    .eq("audio_asset_id", audioAssetId)
    .eq("status", "pending_review");

  if (exceptGenerationId) {
    query = query.neq("id", exceptGenerationId);
  }

  await query;
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

  const voiceId = resolveVettedVoiceId(options.voiceId);
  const variationCount = Math.min(3, Math.max(1, options.variationCount ?? 1));
  const batchId = variationCount > 1 ? crypto.randomUUID() : null;
  const bucket = bucketForContentType(contentType);
  const baseStoragePath = adapter.storagePath(context);
  const pronunciationLocator = await getPronunciationDictionaryLocator(supabase);
  const locators = pronunciationLocator ? [pronunciationLocator] : undefined;

  const asset =
    assetRow ?? (await ensureAudioAssetRow(supabase, contentType, contentId, scriptText));
  if (!asset) {
    return { ok: false, error: "Failed to create audio asset record." };
  }

  if (options.force && status === "pending_review") {
    await rejectPendingGenerations(supabase, asset.id);
  }

  const generationIds: string[] = [];
  let firstGenerationId = "";
  let firstStoragePath = "";
  let finalScriptText = scriptText;

  for (let take = 0; take < variationCount; take += 1) {
    const storagePath = storagePathForTake(baseStoragePath, take);

    let synthResult;
    try {
      synthResult = await synthesizeSpeech({
        text: scriptText,
        voiceId,
        pronunciationDictionaryLocators: locators,
        seed: variationCount > 1 ? Math.floor(Math.random() * 4294967295) : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "ElevenLabs request failed.";
      console.error(`[audio] TTS failed for ${contentType} ${contentId} take ${take + 1}:`, message);
      if (generationIds.length === 0) {
        return { ok: false, error: message };
      }
      break;
    }

    finalScriptText = synthResult.normalizedText;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, synthResult.audio, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadError) {
      return { ok: false, error: `Storage upload failed: ${uploadError.message}` };
    }

    const { data: generation, error: insertError } = await supabase
      .from("audio_generations")
      .insert({
        audio_asset_id: asset.id,
        script_text: finalScriptText,
        storage_path: storagePath,
        status: "pending_review",
        voice_id: voiceId,
        variation_index: take,
        generation_batch_id: batchId,
      })
      .select("id")
      .single();

    if (insertError || !generation) {
      return {
        ok: false,
        error: insertError?.message ?? "Failed to save generation record.",
      };
    }

    generationIds.push(generation.id);
    if (take === 0) {
      firstGenerationId = generation.id;
      firstStoragePath = storagePath;
    }
  }

  const now = new Date().toISOString();
  const { error: assetError } = await supabase
    .from("audio_assets")
    .update({
      script_text: finalScriptText,
      storage_path: variationCount === 1 ? firstStoragePath : null,
      status: "pending_review",
      updated_at: now,
    })
    .eq("id", asset.id);

  if (assetError) {
    return { ok: false, error: `Audio asset update failed: ${assetError.message}` };
  }

  await adapter.syncOnGenerate(supabase, context, finalScriptText, firstStoragePath);

  return {
    ok: true,
    generationId: firstGenerationId,
    storagePath: firstStoragePath,
    audioAssetId: asset.id,
    generationIds,
    variationCount,
  };
}

type AutoApproveOptions = {
  scriptOverride?: string | null;
  voiceId?: string;
  reviewerId: string;
};

function isAudioAssetUniqueViolation(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("audio_assets_content_unique") ||
    (lower.includes("duplicate key") && lower.includes("audio_assets"))
  );
}

/**
 * Dictionary batch jobs only — synthesize once and persist as approved immediately
 * (skips the manual review queue). Caller must verify no audio_assets row exists yet.
 */
export async function generateAndAutoApproveContentAudio(
  supabase: SupabaseClient,
  contentType: AudioContentType,
  contentId: string,
  options: AutoApproveOptions
): Promise<GenerateAudioResult> {
  const adapter = getAudioContentAdapter(contentType);
  const context = await adapter.loadContext(supabase, contentId);

  if (!context) {
    return { ok: false, error: "Content not found." };
  }

  const scriptText = resolveScriptText(context, options.scriptOverride);
  if (!scriptText) {
    return { ok: false, error: "Add a script (Punjabi text) before generating." };
  }

  const existing = await loadAudioAsset(supabase, contentType, contentId);
  if (existing) {
    return { ok: false, error: "Audio asset already exists.", skipped: true };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return { ok: false, error: "NEXT_PUBLIC_SUPABASE_URL is not set." };
  }

  const voiceId = resolveVettedVoiceId(options.voiceId);
  const bucket = bucketForContentType(contentType);
  const storagePath = adapter.storagePath(context);
  const pronunciationLocator = await getPronunciationDictionaryLocator(supabase);
  const locators = pronunciationLocator ? [pronunciationLocator] : undefined;

  let synthResult;
  try {
    synthResult = await synthesizeSpeech({
      text: scriptText,
      voiceId,
      pronunciationDictionaryLocators: locators,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ElevenLabs request failed.";
    console.error(`[audio] TTS failed for ${contentType} ${contentId}:`, message);
    return { ok: false, error: message };
  }

  const finalScriptText = synthResult.normalizedText;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, synthResult.audio, {
      contentType: "audio/mpeg",
      upsert: true,
    });

  if (uploadError) {
    return { ok: false, error: `Storage upload failed: ${uploadError.message}` };
  }

  const publicUrl = getPublicAudioUrl(supabaseUrl, contentType, storagePath);
  const now = new Date().toISOString();

  const { data: asset, error: assetError } = await supabase
    .from("audio_assets")
    .insert({
      content_type: contentType,
      content_id: contentId,
      script_text: finalScriptText,
      storage_path: storagePath,
      audio_url: publicUrl,
      status: "approved",
      reviewed_by: options.reviewerId,
      reviewed_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (assetError || !asset) {
    const message = assetError?.message ?? "Failed to create audio asset record.";
    if (isAudioAssetUniqueViolation(message)) {
      return { ok: false, error: "Audio asset already exists.", skipped: true };
    }
    return { ok: false, error: message };
  }

  const { data: generation, error: generationError } = await supabase
    .from("audio_generations")
    .insert({
      audio_asset_id: asset.id,
      script_text: finalScriptText,
      storage_path: storagePath,
      status: "approved",
      voice_id: voiceId,
      variation_index: 0,
      reviewed_by: options.reviewerId,
      reviewed_at: now,
    })
    .select("id")
    .single();

  if (generationError || !generation) {
    return {
      ok: false,
      error: generationError?.message ?? "Failed to save generation record.",
    };
  }

  await adapter.syncOnApprove(supabase, context, publicUrl);

  return {
    ok: true,
    generationId: generation.id,
    storagePath,
    audioAssetId: asset.id,
    variationCount: 1,
  };
}

export function getPublicAudioUrl(
  supabaseUrl: string,
  contentType: AudioContentType,
  storagePath: string
): string {
  return publicUrlForAudioPath(supabaseUrl, bucketForContentType(contentType), storagePath);
}

export function getPublicLessonAudioUrl(supabaseUrl: string, storagePath: string): string {
  return getPublicAudioUrl(supabaseUrl, "lesson", storagePath);
}

export async function approveContentAudio(
  supabase: SupabaseClient,
  contentType: AudioContentType,
  contentId: string,
  reviewerId: string,
  generationId?: string
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
  if (!asset) {
    return { ok: false, error: "No audio asset found." };
  }

  const generations = await loadGenerationsForAsset(supabase, asset.id);
  const pending = generations.filter((g) => g.status === "pending_review");

  if (pending.length === 0) {
    return { ok: false, error: "No pending audio to approve." };
  }

  const chosen =
    (generationId ? pending.find((g) => g.id === generationId) : null) ??
    (pending.length === 1 ? pending[0] : null);

  if (!chosen) {
    return {
      ok: false,
      error: "Multiple variations are pending — pick which take to approve.",
    };
  }

  const publicUrl = getPublicAudioUrl(supabaseUrl, contentType, chosen.storage_path);
  const now = new Date().toISOString();

  await rejectPendingGenerations(supabase, asset.id, chosen.id);

  const { error: generationError } = await supabase
    .from("audio_generations")
    .update({
      status: "approved",
      reviewed_by: reviewerId,
      reviewed_at: now,
    })
    .eq("id", chosen.id);

  if (generationError) {
    return { ok: false, error: generationError.message };
  }

  const { error: assetError } = await supabase
    .from("audio_assets")
    .update({
      audio_url: publicUrl,
      storage_path: chosen.storage_path,
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
  if (!asset) {
    return { ok: false, error: "No pending audio to reject." };
  }

  const generations = await loadGenerationsForAsset(supabase, asset.id);
  const pending = generations.filter((g) => g.status === "pending_review");

  if (pending.length === 0) {
    return { ok: false, error: "No pending audio to reject." };
  }

  const now = new Date().toISOString();

  for (const generation of pending) {
    await supabase
      .from("audio_generations")
      .update({
        status: "rejected",
        review_notes: notes,
        reviewed_by: reviewerId,
        reviewed_at: now,
      })
      .eq("id", generation.id);
  }

  const { error: assetError } = await supabase
    .from("audio_assets")
    .update({
      status: "needs_changes",
      review_notes: notes,
      reviewed_by: reviewerId,
      reviewed_at: now,
      storage_path: null,
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

export async function generateLessonAudio(
  supabase: SupabaseClient,
  lessonId: string,
  options: GenerateOptions = {}
) {
  return generateContentAudio(supabase, "lesson", lessonId, options);
}

export async function approveLessonAudio(
  supabase: SupabaseClient,
  lessonId: string,
  reviewerId: string,
  generationId?: string
) {
  return approveContentAudio(supabase, "lesson", lessonId, reviewerId, generationId);
}

export async function rejectLessonAudio(
  supabase: SupabaseClient,
  lessonId: string,
  reviewerId: string,
  reviewNotes: string
) {
  return rejectContentAudio(supabase, "lesson", lessonId, reviewerId, reviewNotes);
}

export async function updateLessonAudioScript(
  supabase: SupabaseClient,
  lessonId: string,
  script: string
) {
  return updateContentAudioScript(supabase, "lesson", lessonId, script);
}
