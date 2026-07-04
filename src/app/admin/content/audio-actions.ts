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
import { loadGenerationsForAsset } from "@/lib/audio/load-audio-asset";
import type { AudioAssetStatus, AudioContentType, AudioGeneration } from "@/lib/audio/types";
import { revalidatePath } from "next/cache";

const ADMIN_CURRICULUM_PATH = "/admin/content/curriculum";
const ADMIN_GAMES_PATH = "/admin/content/games";

export type AudioActionResult = { error?: string; success?: string };

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
  generations: AudioGeneration[];
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
  if (contentType === "lesson") {
    revalidatePath("/dashboard/learn");
  }
  if (contentType === "comprehension_sentence") {
    revalidatePath(ADMIN_GAMES_PATH);
    revalidatePath("/dashboard/games/comprehension-practice");
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

      items.push({
        contentType,
        contentId,
        title: context.title,
        subtitle: context.subtitle,
        contentTypeLabel: adapter.label,
        scriptText: asset.script_text,
        status: asset.status as AudioAssetStatus,
        storagePath,
        pendingAudioUrl: storagePath
          ? getPublicAudioUrl(supabaseUrl, contentType, storagePath)
          : null,
        approvedAudioUrl: asset.audio_url,
        reviewNotes: asset.review_notes,
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
  scriptOverride?: string | null
): Promise<AudioActionResult> {
  try {
    const { supabase } = await requireAdminUser();
    const result = await generateContentAudio(supabase, contentType, contentId, {
      scriptOverride,
      force: true,
    });

    if (!result.ok) {
      return { error: result.error };
    }

    revalidateAudioPaths(contentType);
    return { success: "Audio generated — pending review." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Generation failed." };
  }
}

export async function approveContentAudioAction(
  contentType: AudioContentType,
  contentId: string
): Promise<AudioActionResult> {
  try {
    const { user, supabase } = await requireAdminUser();
    const result = await approveContentAudio(supabase, contentType, contentId, user.id);

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
  script: string
): Promise<AudioActionResult> {
  try {
    const { supabase } = await requireAdminUser();

    const saveResult = await updateContentAudioScript(supabase, contentType, contentId, script);
    if (!saveResult.ok) {
      return { error: saveResult.error };
    }

    const result = await generateContentAudio(supabase, contentType, contentId, {
      scriptOverride: script,
      force: true,
    });

    if (!result.ok) {
      return { error: result.error };
    }

    revalidateAudioPaths(contentType);
    return { success: "Regenerated — back in pending review." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Regeneration failed." };
  }
}

export async function loadContentAudioAsset(
  contentType: AudioContentType,
  contentId: string
): Promise<
  AudioActionResult & {
    asset?: {
      scriptText: string | null;
      status: AudioAssetStatus;
      approvedAudioUrl: string | null;
    };
  }
> {
  try {
    const { supabase } = await requireAdminUser();
    const { data, error } = await supabase
      .from("audio_assets")
      .select("script_text, status, audio_url")
      .eq("content_type", contentType)
      .eq("content_id", contentId)
      .maybeSingle();

    if (error) {
      return { error: error.message };
    }

    return {
      asset: {
        scriptText: data?.script_text ?? null,
        status: (data?.status as AudioAssetStatus) ?? "none",
        approvedAudioUrl: data?.audio_url ?? null,
      },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load audio asset." };
  }
}

/** @deprecated Use loadAudioReviewQueue */
export const loadLessonAudioReviewQueue = loadAudioReviewQueue;

/** @deprecated Use generateContentAudioAction */
export async function generateLessonAudioAction(lessonId: string, scriptOverride?: string | null) {
  return generateContentAudioAction("lesson", lessonId, scriptOverride);
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
