import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

function normalizeRecordingUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Keep student-facing lesson_recordings in sync when a recording is saved on a cohort lesson log.
 * Learn reads lesson_recordings first; log recording_url alone used to not show for students.
 */
export async function syncCohortLessonRecordingFromLog(
  supabase: SupabaseClient,
  params: {
    cohortId: string;
    lessonId: string;
    recordingUrl: string | null | undefined;
    uploadedBy?: string | null;
  }
): Promise<void> {
  const url = normalizeRecordingUrl(params.recordingUrl);

  const { data: existing } = await supabase
    .from("lesson_recordings")
    .select("id")
    .eq("lesson_id", params.lessonId)
    .eq("cohort_id", params.cohortId)
    .maybeSingle();

  if (!url) {
    if (existing?.id) {
      await supabase.from("lesson_recordings").delete().eq("id", existing.id);
    }
    return;
  }

  const payload = {
    lesson_id: params.lessonId,
    student_id: null,
    cohort_id: params.cohortId,
    storage_path: url,
    title: null,
    uploaded_by: params.uploadedBy ?? null,
    updated_at: new Date().toISOString(),
  };

  if (!payload.uploaded_by) {
    // lesson_recordings.uploaded_by is NOT NULL — reuse any prior uploader if actor unknown.
    const { data: prior } = await supabase
      .from("lesson_recordings")
      .select("uploaded_by")
      .not("uploaded_by", "is", null)
      .limit(1)
      .maybeSingle();
    if (!prior?.uploaded_by) return;
    payload.uploaded_by = prior.uploaded_by as string;
  }

  if (existing?.id) {
    await supabase.from("lesson_recordings").update(payload).eq("id", existing.id);
  } else {
    await supabase.from("lesson_recordings").insert(payload);
  }
}
