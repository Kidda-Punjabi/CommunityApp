"use server";

import { createClient } from "@/lib/supabase/server";
import { homeworkWrite, resolveCourseActor, studentActorFilter } from "@/lib/kids/course-actor";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { getHomeworkSubmissionTiming } from "@/lib/tutoring/homework-near-lesson";
import {
  HOMEWORK_RECORDING_UPLOAD_ERROR,
  buildHomeworkRecordingStoragePath,
  isOwnHomeworkRecordingPath,
  isUuid,
  mimeMatchesHomeworkRecordingPath,
} from "@/lib/tutoring/homework-recording-upload";
import { persistVoiceHomework } from "@/lib/tutoring/submit-homework";
import { homeworkStorageClient } from "@/lib/tutoring/homework-storage";
import {
  HOMEWORK_ALREADY_SUBMITTED_MESSAGE,
  HOMEWORK_RECORDINGS_BUCKET,
  createHomeworkPlaybackUrl,
  homeworkSubmitErrorMessage,
  homeworkTimingWarningMessage,
} from "@/lib/tutoring/homework-submissions";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

export type HomeworkActionResult = {
  error?: string;
  success?: string;
  playbackUrl?: string;
  nearLessonWarning?: string | null;
  timingState?: "on_time" | "late" | "post_lesson" | "unknown" | null;
};

export type HomeworkRecordingUploadUrlResult = {
  error?: string;
  path?: string;
  token?: string;
};

function revalidateHomeworkPaths(lessonId?: string) {
  revalidatePath("/dashboard/learn");
  revalidatePath("/dashboard/learn/foundational");
  revalidatePath("/dashboard/learn/beginners");
  revalidatePath("/dashboard/learn/kids");
  if (lessonId) {
    revalidatePath(`/dashboard/learn/homework/${lessonId}`);
  }
}

export async function getHomeworkPlaybackUrl(
  storagePath: string
): Promise<HomeworkActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "You must be signed in." };

    const { data: readable } = await supabase
      .from("homework_submissions")
      .select("id")
      .eq("storage_path", storagePath)
      .maybeSingle();
    if (!readable) return { error: "Could not load audio." };

    const playbackUrl = await createHomeworkPlaybackUrl(
      homeworkStorageClient(supabase),
      storagePath
    );
    if (!playbackUrl) return { error: "Could not load audio." };

    return { playbackUrl };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not load audio." };
  }
}

export async function getHomeworkNearLessonWarning(
  lessonId: string
): Promise<HomeworkActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { nearLessonWarning: null, timingState: null };

    const timing = await getHomeworkSubmissionTiming(supabase, user.id, lessonId);
    return {
      nearLessonWarning: homeworkTimingWarningMessage(timing.state, {
        nextLessonStartsAt: timing.nextLessonStartsAt,
        usesKidsNextLesson: timing.usesKidsNextLesson,
      }),
      timingState: timing.state,
    };
  } catch {
    // Soft warning only — never block submission if lookup fails.
    return { nearLessonWarning: null, timingState: null };
  }
}

export async function submitHomeworkRecording(
  lessonId: string,
  formData: FormData
): Promise<HomeworkActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "You must be signed in." };

    const file = formData.get("audio");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Please record your homework before submitting." };
    }

    const durationRaw = formData.get("duration_seconds");
    const durationSeconds =
      typeof durationRaw === "string" && durationRaw.trim()
        ? Number.parseInt(durationRaw, 10)
        : null;

    const actor = await resolveCourseActor(supabase, user.id);
    const persisted = await persistVoiceHomework({
      supabase,
      actor,
      lessonId,
      file,
      durationSeconds,
    });
    if ("error" in persisted) return { error: persisted.error };

    revalidateHomeworkPaths(lessonId);
    return { success: "Homework submitted! Your tutor will review it soon." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to submit homework." };
  }
}

async function removeUnreferencedRecording(
  supabase: SupabaseClient,
  storagePath: string
): Promise<void> {
  const { data: referenced } = await supabase
    .from("homework_submissions")
    .select("id")
    .eq("storage_path", storagePath)
    .maybeSingle();
  if (referenced) return;

  const storage = tryCreateServiceRoleClient();
  if (!storage.client) return;
  await storage.client.storage.from(HOMEWORK_RECORDINGS_BUCKET).remove([storagePath]);
}

/**
 * Mint a signed upload URL for the signed-in student (or their active kid).
 * The path is chosen here. Callers cannot supply a student id or storage path.
 */
export async function createHomeworkRecordingUploadUrl(
  lessonId: string,
  mimeType: string
): Promise<HomeworkRecordingUploadUrlResult> {
  try {
    if (!isUuid(lessonId)) return { error: HOMEWORK_RECORDING_UPLOAD_ERROR };

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "You must be signed in." };

    const actor = await resolveCourseActor(supabase, user.id);
    const storagePath = buildHomeworkRecordingStoragePath(actor, mimeType);
    if (!storagePath || !isOwnHomeworkRecordingPath(actor, storagePath)) {
      return { error: HOMEWORK_RECORDING_UPLOAD_ERROR };
    }

    const studentFilter = studentActorFilter(actor);
    const { data: existing } = await supabase
      .from("homework_submissions")
      .select("id")
      .eq("lesson_id", lessonId)
      .eq(studentFilter.column, studentFilter.value)
      .eq("is_practice", false)
      .maybeSingle();
    if (existing) return { error: HOMEWORK_ALREADY_SUBMITTED_MESSAGE };

    const storage = tryCreateServiceRoleClient();
    if (!storage.client) return { error: HOMEWORK_RECORDING_UPLOAD_ERROR };

    const { data, error } = await storage.client.storage
      .from(HOMEWORK_RECORDINGS_BUCKET)
      .createSignedUploadUrl(storagePath);
    if (error || !data?.token || data.path !== storagePath) {
      return { error: HOMEWORK_RECORDING_UPLOAD_ERROR };
    }

    return { path: storagePath, token: data.token };
  } catch {
    return { error: HOMEWORK_RECORDING_UPLOAD_ERROR };
  }
}

/**
 * Write the homework_submissions row after the browser upload finishes.
 * The file must already exist. A failed insert removes the object so no row is left behind.
 */
export async function confirmHomeworkRecordingSubmission(input: {
  lessonId: string;
  storagePath: string;
  mimeType: string;
  durationSeconds: number | null;
}): Promise<HomeworkActionResult> {
  const storagePath = input.storagePath;
  let uploaded = false;

  try {
    if (!isUuid(input.lessonId)) return { error: HOMEWORK_RECORDING_UPLOAD_ERROR };

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "You must be signed in." };

    const actor = await resolveCourseActor(supabase, user.id);
    if (
      !isOwnHomeworkRecordingPath(actor, storagePath) ||
      !mimeMatchesHomeworkRecordingPath(input.mimeType, storagePath)
    ) {
      return { error: HOMEWORK_RECORDING_UPLOAD_ERROR };
    }

    const studentFilter = studentActorFilter(actor);
    const { data: existing } = await supabase
      .from("homework_submissions")
      .select("id")
      .eq("lesson_id", input.lessonId)
      .eq(studentFilter.column, studentFilter.value)
      .eq("is_practice", false)
      .maybeSingle();
    if (existing) {
      await removeUnreferencedRecording(supabase, storagePath);
      return { error: HOMEWORK_ALREADY_SUBMITTED_MESSAGE };
    }

    const storage = tryCreateServiceRoleClient();
    if (!storage.client) return { error: HOMEWORK_RECORDING_UPLOAD_ERROR };

    const info = await storage.client.storage
      .from(HOMEWORK_RECORDINGS_BUCKET)
      .info(storagePath);
    if (info.error || !info.data || !(typeof info.data.size === "number" && info.data.size > 0)) {
      return { error: HOMEWORK_RECORDING_UPLOAD_ERROR };
    }
    uploaded = true;

    const durationSeconds =
      input.durationSeconds != null &&
      Number.isFinite(input.durationSeconds) &&
      input.durationSeconds >= 0 &&
      input.durationSeconds <= 60 * 60 * 6
        ? Math.round(input.durationSeconds)
        : null;

    const { error: insertError } = await supabase.from("homework_submissions").insert(
      homeworkWrite(actor, {
        lesson_id: input.lessonId,
        submission_type: "voice",
        storage_path: storagePath,
        mime_type: input.mimeType.trim().slice(0, 120) || null,
        duration_seconds: durationSeconds,
        status: "pending_review",
        submitted_at: new Date().toISOString(),
      })
    );

    if (insertError) {
      await removeUnreferencedRecording(supabase, storagePath);
      return { error: homeworkSubmitErrorMessage(insertError) };
    }

    try {
      revalidateHomeworkPaths(input.lessonId);
    } catch {
      // The submission row is already saved.
    }
    return { success: "Homework submitted! Your tutor will review it soon." };
  } catch {
    if (uploaded) {
      try {
        const supabase = await createClient();
        await removeUnreferencedRecording(supabase, storagePath);
      } catch {
        // removeUnreferencedRecording keeps the object when a row already points at it.
      }
    }
    return { error: HOMEWORK_RECORDING_UPLOAD_ERROR };
  }
}
