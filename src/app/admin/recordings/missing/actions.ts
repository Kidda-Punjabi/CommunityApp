"use server";

import { revalidatePath } from "next/cache";
import { canAccessAdminPanel } from "@/lib/auth/admin-access";
import type {
  MissingRecordingCounts,
  MissingRecordingReason,
  MissingRecordingRow,
} from "@/lib/admin/missing-recordings/types";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";

const MISSING_PATH = "/admin/recordings/missing";

async function adminSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await canAccessAdminPanel(user, supabase))) {
    throw new Error("Unauthorized");
  }
  return { supabase, userId: user.id };
}

function messageFrom(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "That action failed.";
}

function asCounts(data: unknown): MissingRecordingCounts {
  const row =
    data && typeof data === "object"
      ? (data as Partial<MissingRecordingCounts>)
      : {};
  return {
    total: Number(row.total ?? 0),
    one_to_one: Number(row.one_to_one ?? 0),
    group: Number(row.group ?? 0),
  };
}

export async function fetchMissingRecordings(): Promise<{
  rows: MissingRecordingRow[];
  counts: MissingRecordingCounts;
  error?: string;
}> {
  try {
    const { supabase } = await adminSession();
    const [rowsResult, countResult] = await Promise.all([
      supabase.rpc("admin_missing_recordings", { p_include_dismissed: true }),
      supabase.rpc("admin_missing_recordings_count"),
    ]);
    if (rowsResult.error) return { rows: [], counts: asCounts(null), error: rowsResult.error.message };
    if (countResult.error) {
      return { rows: [], counts: asCounts(null), error: countResult.error.message };
    }
    return {
      rows: (rowsResult.data ?? []) as MissingRecordingRow[],
      counts: asCounts(countResult.data),
    };
  } catch (error) {
    return { rows: [], counts: asCounts(null), error: messageFrom(error) };
  }
}

function refresh() {
  revalidatePath("/admin");
  revalidatePath(MISSING_PATH);
}

export async function saveMissingRecordingLink(
  entryId: string,
  url: string
): Promise<{ error?: string }> {
  try {
    const { supabase } = await adminSession();
    const { error } = await supabase.rpc("admin_set_recording_link", {
      p_entry_id: entryId,
      p_url: url.trim(),
    });
    if (error) return { error: error.message };
    refresh();
    return {};
  } catch (error) {
    return { error: messageFrom(error) };
  }
}

export async function saveMissingRecordingUpload(
  entryId: string,
  url: string
): Promise<{ error?: string }> {
  try {
    const { supabase, userId } = await adminSession();
    const trimmed = url.trim();
    const { error } = await supabase.rpc("admin_set_recording_link", {
      p_entry_id: entryId,
      p_url: trimmed,
    });
    if (error) return { error: error.message };

    const service = createServiceRoleClient();
    const { data: entry, error: loadError } = await service
      .from("cohort_lesson_log_entries")
      .select("id, cohort_id, package_instance_id, lesson_id, lesson_title")
      .eq("id", entryId)
      .maybeSingle();
    if (loadError) return { error: loadError.message };
    if (!entry?.lesson_id) {
      refresh();
      return {};
    }

    const attached = await attachUploadedRecording(service, {
      entryId,
      lessonId: entry.lesson_id as string,
      cohortId: (entry.cohort_id as string | null) ?? null,
      packageInstanceId: (entry.package_instance_id as string | null) ?? null,
      title: (entry.lesson_title as string | null) ?? null,
      url: trimmed,
      uploadedBy: userId,
    });
    if (attached.error) return { error: attached.error };

    refresh();
    return {};
  } catch (error) {
    return { error: messageFrom(error) };
  }
}

async function attachUploadedRecording(
  supabase: ReturnType<typeof createServiceRoleClient>,
  input: {
    entryId: string;
    lessonId: string;
    cohortId: string | null;
    packageInstanceId: string | null;
    title: string | null;
    url: string;
    uploadedBy: string;
  }
): Promise<{ error?: string }> {
  let studentId: string | null = null;
  let cohortId: string | null = null;

  if (input.cohortId) {
    cohortId = input.cohortId;
  } else if (input.packageInstanceId) {
    const { data: students, error } = await supabase
      .from("student_packages")
      .select("user_id")
      .eq("package_instance_id", input.packageInstanceId)
      .eq("status", "confirmed")
      .limit(1);
    if (error) return { error: error.message };
    studentId = (students?.[0]?.user_id as string | undefined) ?? null;
    if (!studentId) return {};
  } else {
    return {};
  }

  let existingQuery = supabase
    .from("lesson_recordings")
    .select("id")
    .eq("lesson_id", input.lessonId);
  existingQuery = cohortId
    ? existingQuery.eq("cohort_id", cohortId)
    : existingQuery.eq("student_id", studentId);

  const { data: existing, error: existingError } = await existingQuery.maybeSingle();
  if (existingError) return { error: existingError.message };

  const payload = {
    lesson_id: input.lessonId,
    student_id: studentId,
    cohort_id: cohortId,
    storage_path: input.url,
    title: input.title,
    uploaded_by: input.uploadedBy,
    lesson_log_entry_id: input.entryId,
    updated_at: new Date().toISOString(),
  };

  const { error } = existing?.id
    ? await supabase.from("lesson_recordings").update(payload).eq("id", existing.id)
    : await supabase.from("lesson_recordings").insert(payload);
  if (error) return { error: error.message };
  return {};
}

export async function dismissMissingRecording(
  entryId: string,
  reason: MissingRecordingReason,
  note: string
): Promise<{ error?: string }> {
  try {
    const { supabase } = await adminSession();
    const { error } = await supabase.rpc("admin_dismiss_missing_recording", {
      p_entry_id: entryId,
      p_reason: reason,
      p_note: note.trim() || null,
    });
    if (error) return { error: error.message };
    refresh();
    return {};
  } catch (error) {
    return { error: messageFrom(error) };
  }
}

export async function undismissMissingRecording(entryId: string): Promise<{ error?: string }> {
  try {
    const { supabase } = await adminSession();
    const { error } = await supabase.rpc("admin_undismiss_missing_recording", {
      p_entry_id: entryId,
    });
    if (error) return { error: error.message };
    refresh();
    return {};
  } catch (error) {
    return { error: messageFrom(error) };
  }
}
