"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { canAccessAdminPanel } from "@/lib/auth/admin-access";
import { revalidatePath } from "next/cache";
import {
  TEACHING_VISUAL_TYPES,
  type TeachingVisualType,
} from "@/lib/catchup/teaching-visuals/types";
import { normalizeTeachingVisualConfig } from "@/lib/catchup/teaching-visuals/defaults";

const ADMIN_CURRICULUM_PATH = "/admin/content/curriculum";

export type ActionResult = { error?: string; success?: string };

export type CatchupBeatAdmin = {
  id: string;
  segmentId: string;
  beatNumber: number;
  beatType: "narration" | "phrase_reference";
  scriptText: string | null;
  sourceContentType: string | null;
  sourceContentId: string | null;
};

export type CatchupSegmentAdmin = {
  id: string;
  lessonId: string;
  segmentNumber: number;
  sortOrder: number;
  title: string;
  teachingVisualType: string | null;
  teachingVisualConfig: Record<string, unknown> | null;
  activityType: string;
  activityRefId: string | null;
  activityInstructions: string | null;
  beats: CatchupBeatAdmin[];
};

async function requireAdmin() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user || !(await canAccessAdminPanel(user, authClient))) {
    throw new Error("Unauthorized");
  }

  return createServiceRoleClient();
}

function revalidateCatchup() {
  revalidatePath(ADMIN_CURRICULUM_PATH);
  revalidatePath("/catchup", "layout");
}

export async function loadCatchupSegmentsAction(
  lessonId: string
): Promise<ActionResult & { segments?: CatchupSegmentAdmin[] }> {
  try {
    const supabase = await requireAdmin();

    const { data: segmentRows, error: segmentError } = await supabase
      .from("lesson_segments")
      .select(
        "id, lesson_id, segment_number, sort_order, title, teaching_visual_type, teaching_visual_config, activity_type, activity_ref_id, activity_instructions"
      )
      .eq("lesson_id", lessonId)
      .order("sort_order", { ascending: true });

    if (segmentError) return { error: segmentError.message };

    const segmentIds = (segmentRows ?? []).map((row) => row.id);
    const { data: beatRows, error: beatError } =
      segmentIds.length > 0
        ? await supabase
            .from("lesson_segment_beats")
            .select(
              "id, segment_id, beat_number, beat_type, script_text, source_content_type, source_content_id"
            )
            .in("segment_id", segmentIds)
            .order("beat_number", { ascending: true })
        : { data: [], error: null };

    if (beatError) return { error: beatError.message };

    const beatsBySegment = new Map<string, CatchupBeatAdmin[]>();
    for (const beat of beatRows ?? []) {
      const list = beatsBySegment.get(beat.segment_id) ?? [];
      list.push({
        id: beat.id,
        segmentId: beat.segment_id,
        beatNumber: beat.beat_number,
        beatType: beat.beat_type,
        scriptText: beat.script_text,
        sourceContentType: beat.source_content_type,
        sourceContentId: beat.source_content_id,
      });
      beatsBySegment.set(beat.segment_id, list);
    }

    const segments: CatchupSegmentAdmin[] = (segmentRows ?? []).map((row) => ({
      id: row.id,
      lessonId: row.lesson_id,
      segmentNumber: row.segment_number,
      sortOrder: row.sort_order,
      title: row.title,
      teachingVisualType: row.teaching_visual_type,
      teachingVisualConfig: (row.teaching_visual_config as Record<string, unknown> | null) ?? null,
      activityType: row.activity_type,
      activityRefId: row.activity_ref_id,
      activityInstructions: row.activity_instructions,
      beats: beatsBySegment.get(row.id) ?? [],
    }));

    return { segments };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to load segments." };
  }
}

export async function saveCatchupSegmentAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const id = String(formData.get("id") ?? "").trim();
    const lessonId = String(formData.get("lesson_id") ?? "").trim();
    const segmentNumber = Number(formData.get("segment_number"));
    const sortOrder = Number(formData.get("sort_order"));
    const title = String(formData.get("title") ?? "").trim();
    const teachingVisualType = String(formData.get("teaching_visual_type") ?? "").trim();
    const teachingVisualConfigRaw = String(formData.get("teaching_visual_config") ?? "").trim();
    const activityType = String(formData.get("activity_type") ?? "none").trim();
    const activityRefId = String(formData.get("activity_ref_id") ?? "").trim() || null;
    const activityInstructions =
      String(formData.get("activity_instructions") ?? "").trim() || null;

    if (!lessonId || !title || !Number.isFinite(segmentNumber) || segmentNumber < 1) {
      return { error: "Lesson, title, and segment number are required." };
    }

    if (!TEACHING_VISUAL_TYPES.includes(teachingVisualType as TeachingVisualType)) {
      return { error: "Pick a teaching visual template." };
    }

    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = JSON.parse(teachingVisualConfigRaw) as Record<string, unknown>;
    } catch {
      return { error: "Teaching visual config is invalid." };
    }

    const normalizedConfig = normalizeTeachingVisualConfig(
      teachingVisualType as TeachingVisualType,
      parsedConfig
    );

    const payload = {
      lesson_id: lessonId,
      segment_number: segmentNumber,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : segmentNumber,
      title,
      teaching_visual_type: teachingVisualType,
      teaching_visual_config: normalizedConfig,
      activity_type: activityType,
      activity_ref_id: activityRefId,
      activity_instructions: activityInstructions,
    };

    if (id) {
      const { error } = await supabase.from("lesson_segments").update(payload).eq("id", id);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from("lesson_segments").insert(payload);
      if (error) return { error: error.message };
    }

    revalidateCatchup();
    return { success: "Segment saved." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to save segment." };
  }
}

export async function deleteCatchupSegmentAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const id = String(formData.get("id") ?? "").trim();
    if (!id) return { error: "Segment id is required." };

    const { error } = await supabase.from("lesson_segments").delete().eq("id", id);
    if (error) return { error: error.message };

    revalidateCatchup();
    return { success: "Segment deleted." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to delete segment." };
  }
}

export async function saveCatchupBeatAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const id = String(formData.get("id") ?? "").trim();
    const segmentId = String(formData.get("segment_id") ?? "").trim();
    const beatNumber = Number(formData.get("beat_number"));
    const beatType = String(formData.get("beat_type") ?? "narration").trim();
    const scriptText = String(formData.get("script_text") ?? "").trim() || null;
    const sourceContentType = String(formData.get("source_content_type") ?? "").trim() || null;
    const sourceContentId = String(formData.get("source_content_id") ?? "").trim() || null;

    if (!segmentId || !Number.isFinite(beatNumber) || beatNumber < 1) {
      return { error: "Segment and beat number are required." };
    }

    if (beatType === "narration" && !scriptText) {
      return { error: "Narration beats need script text." };
    }

    if (beatType === "phrase_reference" && (!sourceContentType || !sourceContentId)) {
      return { error: "Phrase beats need a flashcard or grammar sentence." };
    }

    const payload = {
      segment_id: segmentId,
      beat_number: beatNumber,
      beat_type: beatType,
      script_text: beatType === "narration" ? scriptText : null,
      source_content_type: beatType === "phrase_reference" ? sourceContentType : null,
      source_content_id: beatType === "phrase_reference" ? sourceContentId : null,
    };

    if (id) {
      const { error } = await supabase.from("lesson_segment_beats").update(payload).eq("id", id);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from("lesson_segment_beats").insert(payload);
      if (error) return { error: error.message };
    }

    revalidateCatchup();
    return { success: "Beat saved." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to save beat." };
  }
}

export async function deleteCatchupBeatAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const id = String(formData.get("id") ?? "").trim();
    if (!id) return { error: "Beat id is required." };

    const { error } = await supabase.from("lesson_segment_beats").delete().eq("id", id);
    if (error) return { error: error.message };

    revalidateCatchup();
    return { success: "Beat deleted." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to delete beat." };
  }
}
