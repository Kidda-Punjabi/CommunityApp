"use server";

import { createClient } from "@/lib/supabase/server";
import { awardQuizAttemptPoints } from "@/lib/leaderboard/points";
import type { TextHomeworkAnswer } from "@/lib/catchup/load-segment-questions";
import {
  HOMEWORK_ALREADY_SUBMITTED_MESSAGE,
  homeworkSubmitErrorMessage,
  homeworkTimingWarningMessage,
} from "@/lib/tutoring/homework-submissions";
import { getHomeworkTimingState } from "@/lib/tutoring/homework-near-lesson";
import { homeworkWrite, resolveCourseActor, studentActorFilter } from "@/lib/kids/course-actor";
import { revalidatePath } from "next/cache";

export type CatchupActionResult = {
  error?: string;
  success?: string;
  pointsEarned?: number;
  nearLessonWarning?: string | null;
  timingState?: "on_time" | "late" | "post_lesson" | "unknown" | null;
};

function revalidateCatchupPaths(lessonId?: string) {
  revalidatePath("/catchup", "layout");
  revalidatePath("/dashboard/learn");
  revalidatePath("/dashboard/learn/beginners");
  revalidatePath("/dashboard/learn/foundational");
  revalidatePath("/dashboard/tutor/homework");
  if (lessonId) {
    revalidatePath(`/dashboard/learn/homework/${lessonId}`);
  }
}

export async function awardCatchupActivityPointsAction(
  segmentId: string,
  correct: number,
  total: number
): Promise<CatchupActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "You must be signed in." };

    const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;
    const pointsEarned = await awardQuizAttemptPoints(supabase, scorePercent);

    return { pointsEarned };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not award points." };
  }
}

export async function getCatchupHomeworkNearLessonWarning(
  lessonId: string
): Promise<CatchupActionResult> {
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
    return { nearLessonWarning: null, timingState: null };
  }
}

export async function submitTextHomeworkAction(
  lessonId: string,
  answers: TextHomeworkAnswer[]
): Promise<CatchupActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "You must be signed in." };

    if (!answers.length || answers.some((row) => !row.answer_text?.trim())) {
      return { error: "Please answer every question before submitting." };
    }

    const actor = await resolveCourseActor(supabase, user.id);
    const studentFilter = studentActorFilter(actor);
    const { data: existing } = await supabase
      .from("homework_submissions")
      .select("id")
      .eq("lesson_id", lessonId)
      .eq(studentFilter.column, studentFilter.value)
      .eq("is_practice", false)
      .maybeSingle();

    if (existing) {
      return { error: HOMEWORK_ALREADY_SUBMITTED_MESSAGE };
    }

    const { error: insertError } = await supabase.from("homework_submissions").insert(
      homeworkWrite(actor, {
        lesson_id: lessonId,
        submission_type: "text",
        text_answers: answers.map((row) => ({
          question_number: row.question_number,
          answer_text: row.answer_text.trim(),
        })),
        status: "pending_review",
        submitted_at: new Date().toISOString(),
      })
    );

    if (insertError) return { error: homeworkSubmitErrorMessage(insertError) };

    revalidateCatchupPaths(lessonId);
    return { success: "Homework submitted! Your tutor will review your written answers." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to submit homework." };
  }
}

export async function submitPracticeRecordingAction(
  lessonId: string,
  formData: FormData
): Promise<CatchupActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "You must be signed in." };

    const file = formData.get("audio");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Please record your practice first." };
    }

    const durationRaw = formData.get("duration_seconds");
    const durationSeconds =
      typeof durationRaw === "string" && durationRaw.trim()
        ? Number.parseInt(durationRaw, 10)
        : null;

    const actor = await resolveCourseActor(supabase, user.id);
    const extension = file.name.split(".").pop() || "webm";
    const storagePath = `${lessonId}/${actor.kind === "kid" ? actor.kidProfileId : user.id}/practice-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("homework-recordings")
      .upload(storagePath, file, {
        contentType: file.type || "audio/webm",
        upsert: false,
      });

    if (uploadError) return { error: uploadError.message };

    const { error: insertError } = await supabase.from("homework_submissions").insert(
      homeworkWrite(actor, {
        lesson_id: lessonId,
        submission_type: "voice",
        storage_path: storagePath,
        mime_type: file.type || null,
        duration_seconds:
          durationSeconds != null && Number.isFinite(durationSeconds) ? durationSeconds : null,
        status: "pending_review",
        is_practice: true,
        submitted_at: new Date().toISOString(),
      })
    );

    if (insertError) {
      await supabase.storage.from("homework-recordings").remove([storagePath]);
      return { error: insertError.message };
    }

    return { success: "Practice recording saved." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to save practice recording." };
  }
}
