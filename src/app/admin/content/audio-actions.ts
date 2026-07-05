"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { canAccessAdminPanel } from "@/lib/auth/admin-access";
import { getAudioContentAdapter } from "@/lib/audio/content-adapters";
import {
  approveContentAudio,
  formatAudioReviewTitle,
  generateContentAudio,
  getPublicAudioUrl,
  rejectContentAudio,
  updateContentAudioScript,
} from "@/lib/audio/generate-audio";
import { getVettedVoice } from "@/lib/elevenlabs/constants";
import {
  loadPronunciationRules,
  upsertPronunciationRule,
  type PronunciationRule,
  type PronunciationRuleType,
} from "@/lib/elevenlabs/pronunciation-dictionary";
import { loadAudioAsset, loadGenerationsForAsset } from "@/lib/audio/load-audio-asset";
import type { AudioAssetStatus, AudioContentType, AudioGeneration } from "@/lib/audio/types";
import { revalidatePath } from "next/cache";

const ADMIN_CURRICULUM_PATH = "/admin/content/curriculum";
const ADMIN_GAMES_PATH = "/admin/content/games";
const ADMIN_AUDIO_REVIEW_PATH = "/admin/content/audio-review";
const MASTER_DECK_NAME = "Vocabulary - Master List";

export type AudioActionResult = { error?: string; success?: string };

export type BulkAudioActionResult = AudioActionResult & {
  processed?: number;
  succeeded?: number;
  failed?: number;
};

export type PendingVariation = {
  id: string;
  storagePath: string;
  pendingAudioUrl: string;
  voiceId: string | null;
  voiceLabel: string;
  variationIndex: number;
};

export type AudioReviewItem = {
  contentType: AudioContentType;
  contentId: string;
  title: string;
  subtitle: string | null;
  contentTypeLabel: string;
  scriptText: string | null;
  status: AudioAssetStatus;
  storagePath: string | null;
  pendingAudioUrl: string | null;
  approvedAudioUrl: string | null;
  reviewNotes: string | null;
  pendingVariations: PendingVariation[];
  generations: AudioGeneration[];
};

export type GenerateAudioActionOptions = {
  scriptOverride?: string | null;
  voiceId?: string;
  variationCount?: number;
};

async function requireAdminUser() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user || !(await canAccessAdminPanel(user, authClient))) {
    throw new Error("Unauthorized");
  }

  return { user, supabase: createServiceRoleClient() };
}

function revalidateAudioPaths(contentType: AudioContentType) {
  revalidatePath(ADMIN_CURRICULUM_PATH);
  revalidatePath(ADMIN_AUDIO_REVIEW_PATH);
  if (contentType === "lesson") {
    revalidatePath("/dashboard/learn");
  }
  if (contentType === "comprehension_sentence") {
    revalidatePath(ADMIN_GAMES_PATH);
    revalidatePath("/dashboard/games/comprehension-practice");
  }
  if (contentType === "conversation_turn") {
    revalidatePath(ADMIN_GAMES_PATH);
    revalidatePath("/dashboard/games/conversation-practice");
  }
  if (
    contentType === "conversation_exchange_npc_setup" ||
    contentType === "conversation_exchange_npc_reply" ||
    contentType === "conversation_exchange_player_response"
  ) {
    revalidatePath(ADMIN_GAMES_PATH);
    revalidatePath("/dashboard/games/conversation-practice");
  }
  if (contentType === "lesson_segment_beat") {
    revalidatePath("/catchup", "layout");
  }
  if (contentType === "flashcard" || contentType === "flashcard_example") {
    revalidatePath("/dashboard/games/dictionary");
  }
}

export async function loadAudioReviewQueue(): Promise<
  AudioActionResult & { items?: AudioReviewItem[] }
> {
  try {
    const { supabase } = await requireAdminUser();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return { error: "NEXT_PUBLIC_SUPABASE_URL is not set." };
    }

    const { data: assets, error } = await supabase
      .from("audio_assets")
      .select("*")
      .in("status", ["pending_review", "needs_changes"])
      .order("updated_at", { ascending: false });

    if (error) {
      return { error: error.message };
    }

    const items: AudioReviewItem[] = [];

    for (const asset of assets ?? []) {
      const contentType = asset.content_type as AudioContentType;
      const contentId = asset.content_id as string;
      const adapter = getAudioContentAdapter(contentType);
      const context = await adapter.loadContext(supabase, contentId);

      if (!context) continue;

      const generations = await loadGenerationsForAsset(supabase, asset.id);
      const storagePath = asset.storage_path as string | null;
      const pendingGens = generations.filter((g) => g.status === "pending_review");

      const pendingVariations: PendingVariation[] = pendingGens.map((gen) => ({
        id: gen.id,
        storagePath: gen.storage_path,
        pendingAudioUrl: getPublicAudioUrl(supabaseUrl, contentType, gen.storage_path),
        voiceId: gen.voice_id,
        voiceLabel: getVettedVoice(gen.voice_id ?? "")?.label ?? gen.voice_id ?? "Unknown voice",
        variationIndex: gen.variation_index ?? 0,
      }));

      items.push({
        contentType,
        contentId,
        title: context.title,
        subtitle: context.subtitle,
        contentTypeLabel: adapter.label,
        scriptText: asset.script_text,
        status: asset.status as AudioAssetStatus,
        storagePath,
        pendingAudioUrl:
          pendingVariations.length === 1
            ? pendingVariations[0].pendingAudioUrl
            : storagePath
              ? getPublicAudioUrl(supabaseUrl, contentType, storagePath)
              : null,
        approvedAudioUrl: asset.audio_url,
        reviewNotes: asset.review_notes,
        pendingVariations,
        generations,
      });
    }

    items.sort((a, b) => {
      const typeOrder = a.contentTypeLabel.localeCompare(b.contentTypeLabel);
      if (typeOrder !== 0) return typeOrder;
      return formatAudioReviewTitle({
        contentType: a.contentType,
        contentId: a.contentId,
        title: a.title,
        subtitle: a.subtitle,
        defaultScript: "",
      }).localeCompare(
        formatAudioReviewTitle({
          contentType: b.contentType,
          contentId: b.contentId,
          title: b.title,
          subtitle: b.subtitle,
          defaultScript: "",
        })
      );
    });

    return { items };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load review queue." };
  }
}

export async function generateContentAudioAction(
  contentType: AudioContentType,
  contentId: string,
  options: GenerateAudioActionOptions = {}
): Promise<AudioActionResult> {
  try {
    const { supabase } = await requireAdminUser();
    const result = await generateContentAudio(supabase, contentType, contentId, {
      scriptOverride: options.scriptOverride,
      voiceId: options.voiceId,
      variationCount: options.variationCount ?? 1,
      force: true,
    });

    if (!result.ok) {
      return { error: result.error };
    }

    revalidateAudioPaths(contentType);
    const count = result.variationCount ?? 1;
    return {
      success:
        count > 1
          ? `${count} variations generated — pick one in the review queue.`
          : "Audio generated — pending review.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Generation failed." };
  }
}

export async function approveContentAudioAction(
  contentType: AudioContentType,
  contentId: string,
  generationId?: string
): Promise<AudioActionResult> {
  try {
    const { user, supabase } = await requireAdminUser();
    const result = await approveContentAudio(
      supabase,
      contentType,
      contentId,
      user.id,
      generationId
    );

    if (!result.ok) {
      return { error: result.error };
    }

    revalidateAudioPaths(contentType);
    return { success: "Audio approved — now live." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Approval failed." };
  }
}

export async function rejectContentAudioAction(
  contentType: AudioContentType,
  contentId: string,
  reviewNotes: string
): Promise<AudioActionResult> {
  try {
    const { user, supabase } = await requireAdminUser();
    const result = await rejectContentAudio(
      supabase,
      contentType,
      contentId,
      user.id,
      reviewNotes
    );

    if (!result.ok) {
      return { error: result.error };
    }

    revalidateAudioPaths(contentType);
    return { success: "Marked as needs changes." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Rejection failed." };
  }
}

export async function saveContentAudioScriptAction(
  contentType: AudioContentType,
  contentId: string,
  script: string
): Promise<AudioActionResult> {
  try {
    const { supabase } = await requireAdminUser();
    const result = await updateContentAudioScript(supabase, contentType, contentId, script);

    if (!result.ok) {
      return { error: result.error };
    }

    revalidateAudioPaths(contentType);
    return { success: "Script saved." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save script." };
  }
}

export async function regenerateContentAudioAction(
  contentType: AudioContentType,
  contentId: string,
  script: string,
  options: Pick<GenerateAudioActionOptions, "voiceId" | "variationCount"> = {}
): Promise<AudioActionResult> {
  try {
    const { supabase } = await requireAdminUser();

    const saveResult = await updateContentAudioScript(supabase, contentType, contentId, script);
    if (!saveResult.ok) {
      return { error: saveResult.error };
    }

    const result = await generateContentAudio(supabase, contentType, contentId, {
      scriptOverride: script,
      voiceId: options.voiceId,
      variationCount: options.variationCount ?? 1,
      force: true,
    });

    if (!result.ok) {
      return { error: result.error };
    }

    revalidateAudioPaths(contentType);
    const count = result.variationCount ?? 1;
    return {
      success:
        count > 1
          ? `${count} variations regenerated — pick one in the review queue.`
          : "Regenerated — back in pending review.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Regeneration failed." };
  }
}

export async function loadPronunciationRulesAction(): Promise<
  AudioActionResult & { rules?: PronunciationRule[] }
> {
  try {
    const { supabase } = await requireAdminUser();
    const rules = await loadPronunciationRules(supabase);
    return { rules };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load pronunciation rules." };
  }
}

export async function addPronunciationRuleAndRegenerateAction(input: {
  contentType: AudioContentType;
  contentId: string;
  script: string;
  sourceWord: string;
  ruleType: PronunciationRuleType;
  replacement: string;
  reviewNotes?: string;
  voiceId?: string;
  variationCount?: number;
}): Promise<AudioActionResult> {
  try {
    const { user, supabase } = await requireAdminUser();

    const ruleResult = await upsertPronunciationRule(supabase, {
      sourceWord: input.sourceWord,
      ruleType: input.ruleType,
      replacement: input.replacement,
      notes: input.reviewNotes,
    });

    if (!ruleResult.ok) {
      return { error: ruleResult.error };
    }

    if (input.reviewNotes?.trim()) {
      await rejectContentAudio(
        supabase,
        input.contentType,
        input.contentId,
        user.id,
        input.reviewNotes
      );
    }

    return regenerateContentAudioAction(input.contentType, input.contentId, input.script, {
      voiceId: input.voiceId,
      variationCount: input.variationCount,
    }).then((regen) =>
      regen.error
        ? regen
        : {
            success: `Pronunciation rule saved for “${input.sourceWord}” and audio regenerated.`,
          }
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save pronunciation rule." };
  }
}

export type ContentAudioAssetDetail = {
  scriptText: string | null;
  status: AudioAssetStatus;
  approvedAudioUrl: string | null;
  reviewNotes: string | null;
  pendingVariations: PendingVariation[];
  pendingAudioUrl: string | null;
  activeVoiceId: string | null;
  activeVoiceLabel: string | null;
};

export async function loadContentAudioAsset(
  contentType: AudioContentType,
  contentId: string
): Promise<AudioActionResult & { asset?: ContentAudioAssetDetail }> {
  try {
    const { supabase } = await requireAdminUser();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return { error: "NEXT_PUBLIC_SUPABASE_URL is not set." };
    }

    const { data, error } = await supabase
      .from("audio_assets")
      .select("id, script_text, status, audio_url, review_notes, storage_path")
      .eq("content_type", contentType)
      .eq("content_id", contentId)
      .maybeSingle();

    if (error) {
      return { error: error.message };
    }

    if (!data) {
      return {
        asset: {
          scriptText: null,
          status: "none",
          approvedAudioUrl: null,
          reviewNotes: null,
          pendingVariations: [],
          pendingAudioUrl: null,
          activeVoiceId: null,
          activeVoiceLabel: null,
        },
      };
    }

    const generations = await loadGenerationsForAsset(supabase, data.id);
    const pendingGens = generations.filter((g) => g.status === "pending_review");

    const pendingVariations: PendingVariation[] = pendingGens.map((gen) => ({
      id: gen.id,
      storagePath: gen.storage_path,
      pendingAudioUrl: getPublicAudioUrl(supabaseUrl, contentType, gen.storage_path),
      voiceId: gen.voice_id,
      voiceLabel: getVettedVoice(gen.voice_id ?? "")?.label ?? gen.voice_id ?? "Unknown voice",
      variationIndex: gen.variation_index ?? 0,
    }));

    const activeVoiceId =
      pendingGens[0]?.voice_id ??
      generations.find((g) => g.status === "approved")?.voice_id ??
      null;

    const storagePath = data.storage_path as string | null;

    return {
      asset: {
        scriptText: data.script_text,
        status: (data.status as AudioAssetStatus) ?? "none",
        approvedAudioUrl: data.audio_url,
        reviewNotes: data.review_notes,
        pendingVariations,
        pendingAudioUrl:
          pendingVariations.length === 1
            ? pendingVariations[0].pendingAudioUrl
            : storagePath
              ? getPublicAudioUrl(supabaseUrl, contentType, storagePath)
              : null,
        activeVoiceId,
        activeVoiceLabel: activeVoiceId
          ? getVettedVoice(activeVoiceId)?.label ?? activeVoiceId
          : null,
      },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load audio asset." };
  }
}

type GenerateCandidate = {
  contentType: AudioContentType;
  contentId: string;
  script: string;
};

function candidateKey(contentType: AudioContentType, contentId: string): string {
  return `${contentType}:${contentId}`;
}

async function firstPendingGenerationId(
  supabase: Awaited<ReturnType<typeof requireAdminUser>>["supabase"],
  contentType: AudioContentType,
  contentId: string
): Promise<string | null> {
  const asset = await loadAudioAsset(supabase, contentType, contentId);
  if (!asset) return null;

  const generations = await loadGenerationsForAsset(supabase, asset.id);
  const pending = generations
    .filter((generation) => generation.status === "pending_review")
    .sort((a, b) => (a.variation_index ?? 0) - (b.variation_index ?? 0));

  return pending[0]?.id ?? null;
}

async function discoverGenerateCandidates(
  supabase: Awaited<ReturnType<typeof requireAdminUser>>["supabase"],
  options: { contentType?: AudioContentType; limit: number }
): Promise<GenerateCandidate[]> {
  const candidates: GenerateCandidate[] = [];
  const seen = new Set<string>();

  function addCandidate(contentType: AudioContentType, contentId: string, script: string) {
    const key = candidateKey(contentType, contentId);
    if (seen.has(key) || !script.trim() || candidates.length >= options.limit) return;
    seen.add(key);
    candidates.push({ contentType, contentId, script: script.trim() });
  }

  async function addFromAssets(statuses: AudioAssetStatus[]) {
    if (candidates.length >= options.limit) return;

    let query = supabase
      .from("audio_assets")
      .select("content_type, content_id, script_text, status")
      .in("status", statuses)
      .order("updated_at", { ascending: true });

    if (options.contentType) {
      query = query.eq("content_type", options.contentType);
    }

    const { data: assets } = await query.limit(Math.max(options.limit * 4, 40));

    for (const asset of assets ?? []) {
      if (candidates.length >= options.limit) break;

      const contentType = asset.content_type as AudioContentType;
      const contentId = asset.content_id as string;
      const adapter = getAudioContentAdapter(contentType);
      const context = await adapter.loadContext(supabase, contentId);
      if (!context) continue;

      const script =
        (asset.script_text as string | null)?.trim() || context.defaultScript.trim();
      addCandidate(contentType, contentId, script);
    }
  }

  await addFromAssets(["needs_changes"]);
  await addFromAssets(["none"]);

  const flashcardTypes: AudioContentType[] = options.contentType
    ? options.contentType === "flashcard" || options.contentType === "flashcard_example"
      ? [options.contentType]
      : []
    : ["flashcard", "flashcard_example"];

  if (flashcardTypes.length > 0 && candidates.length < options.limit) {
    const { data: masterSet } = await supabase
      .from("flashcard_sets")
      .select("id")
      .eq("name", MASTER_DECK_NAME)
      .maybeSingle();

    if (masterSet) {
      const { data: cards } = await supabase
        .from("flashcards")
        .select("id, example_sentence_gurmukhi")
        .eq("deck_id", masterSet.id)
        .order("front_text");

      const cardIds = (cards ?? []).map((card) => card.id);
      const statusMap = new Map<string, AudioAssetStatus | "missing">();

      if (cardIds.length > 0) {
        const { data: existingAssets } = await supabase
          .from("audio_assets")
          .select("content_type, content_id, status")
          .in("content_type", ["flashcard", "flashcard_example"])
          .in("content_id", cardIds);

        for (const asset of existingAssets ?? []) {
          statusMap.set(
            candidateKey(asset.content_type as AudioContentType, asset.content_id as string),
            asset.status as AudioAssetStatus
          );
        }
      }

      for (const card of cards ?? []) {
        if (candidates.length >= options.limit) break;

        if (flashcardTypes.includes("flashcard")) {
          const key = candidateKey("flashcard", card.id);
          const status = statusMap.get(key) ?? "missing";
          if (status === "missing" || status === "none" || status === "needs_changes") {
            const context = await getAudioContentAdapter("flashcard").loadContext(
              supabase,
              card.id
            );
            if (context) addCandidate("flashcard", card.id, context.defaultScript);
          }
        }

        if (
          flashcardTypes.includes("flashcard_example") &&
          card.example_sentence_gurmukhi?.trim()
        ) {
          const key = candidateKey("flashcard_example", card.id);
          const status = statusMap.get(key) ?? "missing";
          if (status === "missing" || status === "none" || status === "needs_changes") {
            const context = await getAudioContentAdapter("flashcard_example").loadContext(
              supabase,
              card.id
            );
            if (context) addCandidate("flashcard_example", card.id, context.defaultScript);
          }
        }
      }
    }
  }

  return candidates;
}

export async function bulkApprovePendingAudioAction(options?: {
  contentType?: AudioContentType;
  limit?: number;
}): Promise<BulkAudioActionResult> {
  try {
    const { user, supabase } = await requireAdminUser();
    const limit = options?.limit ?? 9999;

    let query = supabase
      .from("audio_assets")
      .select("content_type, content_id")
      .eq("status", "pending_review")
      .order("updated_at", { ascending: true })
      .limit(limit);

    if (options?.contentType) {
      query = query.eq("content_type", options.contentType);
    }

    const { data: assets, error } = await query;
    if (error) {
      return { error: error.message };
    }

    const queue = assets ?? [];
    if (queue.length === 0) {
      return { success: "No pending clips to approve.", processed: 0, succeeded: 0, failed: 0 };
    }

    let succeeded = 0;
    let failed = 0;
    const touchedTypes = new Set<AudioContentType>();

    for (const asset of queue) {
      const contentType = asset.content_type as AudioContentType;
      const contentId = asset.content_id as string;
      const generationId = await firstPendingGenerationId(supabase, contentType, contentId);

      const result = await approveContentAudio(
        supabase,
        contentType,
        contentId,
        user.id,
        generationId ?? undefined
      );

      if (!result.ok) {
        failed += 1;
        continue;
      }

      succeeded += 1;
      touchedTypes.add(contentType);
    }

    for (const contentType of touchedTypes) {
      revalidateAudioPaths(contentType);
    }

    const processed = succeeded + failed;
    return {
      success: `Approved ${succeeded} of ${processed} pending clip${processed === 1 ? "" : "s"}.`,
      processed,
      succeeded,
      failed,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Bulk approval failed." };
  }
}

export async function bulkGenerateAudioAction(options: {
  contentType?: AudioContentType;
  limit: number;
}): Promise<BulkAudioActionResult> {
  try {
    const { supabase } = await requireAdminUser();
    const limit = Math.max(1, Math.min(options.limit, 200));
    const candidates = await discoverGenerateCandidates(supabase, {
      contentType: options.contentType,
      limit,
    });

    if (candidates.length === 0) {
      return {
        success: "No clips need generation.",
        processed: 0,
        succeeded: 0,
        failed: 0,
      };
    }

    let succeeded = 0;
    let failed = 0;
    const touchedTypes = new Set<AudioContentType>();

    for (const candidate of candidates) {
      const result = await generateContentAudio(
        supabase,
        candidate.contentType,
        candidate.contentId,
        {
          scriptOverride: candidate.script,
          variationCount: 1,
          force: true,
        }
      );

      if (!result.ok) {
        failed += 1;
        continue;
      }

      succeeded += 1;
      touchedTypes.add(candidate.contentType);
    }

    for (const contentType of touchedTypes) {
      revalidateAudioPaths(contentType);
    }

    const processed = succeeded + failed;
    return {
      success: `Generated ${succeeded} of ${processed} clip${processed === 1 ? "" : "s"} — now pending review.`,
      processed,
      succeeded,
      failed,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Bulk generation failed." };
  }
}

/** @deprecated Use loadAudioReviewQueue */
export const loadLessonAudioReviewQueue = loadAudioReviewQueue;

/** @deprecated Use generateContentAudioAction */
export async function generateLessonAudioAction(lessonId: string, scriptOverride?: string | null) {
  return generateContentAudioAction("lesson", lessonId, { scriptOverride });
}

/** @deprecated Use approveContentAudioAction */
export async function approveLessonAudioAction(lessonId: string) {
  return approveContentAudioAction("lesson", lessonId);
}

/** @deprecated Use rejectContentAudioAction */
export async function rejectLessonAudioAction(lessonId: string, reviewNotes: string) {
  return rejectContentAudioAction("lesson", lessonId, reviewNotes);
}

/** @deprecated Use saveContentAudioScriptAction */
export async function saveLessonAudioScriptAction(lessonId: string, script: string) {
  return saveContentAudioScriptAction("lesson", lessonId, script);
}

/** @deprecated Use regenerateContentAudioAction */
export async function regenerateLessonAudioAction(lessonId: string, script: string) {
  return regenerateContentAudioAction("lesson", lessonId, script);
}

export type LessonAudioActionResult = AudioActionResult;
export type LessonAudioReviewItem = AudioReviewItem;
