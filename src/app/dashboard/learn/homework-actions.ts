"use server";

import { createClient } from "@/lib/supabase/server";
import { resolveCourseActor } from "@/lib/kids/course-actor";
import { getHomeworkTimingState } from "@/lib/tutoring/homework-near-lesson";
import { persistVoiceHomework } from "@/lib/tutoring/submit-homework";
import {
  createHomeworkPlaybackUrl,
  homeworkTimingWarningMessage,
} from "@/lib/tutoring/homework-submissions";
import { revalidatePath } from "next/cache";

export type HomeworkActionResult = {
  error?: string;
  success?: string;
  playbackUrl?: string;
  nearLessonWarning?: string | null;
  timingState?: "on_time" | "late" | "post_lesson" | "unknown" | null;
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

    const playbackUrl = await createHomeworkPlaybackUrl(supabase, storagePath);
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

    const state = await getHomeworkTimingState(supabase, user.id, lessonId);
    return {
      nearLessonWarning: homeworkTimingWarningMessage(state),
      timingState: state,
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
