"use server";

import { createClient } from "@/lib/supabase/server";
import {
  HOMEWORK_RECORDINGS_BUCKET,
  createHomeworkPlaybackUrl,
  homeworkStoragePath,
} from "@/lib/tutoring/homework-submissions";
import { revalidatePath } from "next/cache";

export type HomeworkActionResult = {
  error?: string;
  success?: string;
  playbackUrl?: string;
};

function revalidateHomeworkPaths() {
  revalidatePath("/dashboard/learn");
  revalidatePath("/dashboard/learn/foundational");
  revalidatePath("/dashboard/learn/beginners");
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

    const playbackUrl = await createHomeworkPlaybackUrl(supabase, storagePath);
    if (!playbackUrl) return { error: "Could not load audio." };

    return { playbackUrl };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not load audio." };
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

    const { data: existing } = await supabase
      .from("homework_submissions")
      .select("id, status")
      .eq("lesson_id", lessonId)
      .eq("student_id", user.id)
      .maybeSingle();

    if (existing) {
      return { error: "You have already submitted homework for this lesson." };
    }

    const extension = file.name.split(".").pop() || "webm";
    const storagePath = homeworkStoragePath(lessonId, user.id, extension);

    const { error: uploadError } = await supabase.storage
      .from(HOMEWORK_RECORDINGS_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type || "audio/webm",
        upsert: false,
      });

    if (uploadError) {
      return { error: uploadError.message };
    }

    const { error: insertError } = await supabase.from("homework_submissions").insert({
      lesson_id: lessonId,
      student_id: user.id,
      storage_path: storagePath,
      mime_type: file.type || null,
      duration_seconds:
        durationSeconds != null && Number.isFinite(durationSeconds)
          ? durationSeconds
          : null,
      status: "pending_review",
      submitted_at: new Date().toISOString(),
    });

    if (insertError) {
      await supabase.storage.from(HOMEWORK_RECORDINGS_BUCKET).remove([storagePath]);
      return { error: insertError.message };
    }

    revalidateHomeworkPaths();
    return { success: "Homework submitted! Your tutor will review it soon." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to submit homework." };
  }
}
