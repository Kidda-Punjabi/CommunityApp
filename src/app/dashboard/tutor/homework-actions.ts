"use server";

import { createClient } from "@/lib/supabase/server";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import {
  HOMEWORK_RECORDINGS_BUCKET,
  loadHomeworkCohortRoster as fetchHomeworkCohortRoster,
  type HomeworkCohortRosterStudent,
} from "@/lib/tutoring/homework-submissions";
import { syncApprovedHomeworkToNotion } from "@/lib/tutoring/sync-approved-homework-to-notion";
import { canAccessTutorDashboard, canManageCohort } from "@/lib/tutoring/tutor-access";
import { revalidatePath } from "next/cache";
import type { HomeworkActionResult } from "@/app/dashboard/learn/homework-actions";
import {
  getHomeworkPlaybackUrl,
  getTutorFeedbackPlaybackUrl,
} from "@/app/dashboard/learn/homework-actions";
import {
  parseTutorFeedbackAudio,
  TUTOR_FEEDBACK_MAX_BYTES,
  type TutorFeedbackAudioMeta,
} from "@/lib/tutoring/tutor-feedback-audio";

export type TutorHomeworkActionResult = HomeworkActionResult;

async function requireTutorHomeworkAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("You must be signed in.");

  const allowed = await canAccessTutorDashboard(supabase, user.id);
  if (!allowed) throw new Error("Tutor access required.");

  return { supabase, userId: user.id };
}

function revalidateTutorHomeworkPaths() {
  revalidatePath("/dashboard/tutor");
  revalidatePath("/dashboard/tutor/homework");
  revalidatePath("/dashboard/learn");
}

async function feedbackFileReady(
  supabase: Awaited<ReturnType<typeof requireTutorHomeworkAction>>["supabase"],
  meta: TutorFeedbackAudioMeta
): Promise<string | null> {
  const storage = tryCreateServiceRoleClient();
  if (!storage.client) return "The voice note could not be saved.";
  const info = await storage.client.storage.from(HOMEWORK_RECORDINGS_BUCKET).info(meta.path);
  if (info.error || !info.data) return "The voice note could not be saved.";
  const size = info.data.size;
  if (typeof size === "number" && (size <= 0 || size > TUTOR_FEEDBACK_MAX_BYTES)) {
    await supabase.storage.from(HOMEWORK_RECORDINGS_BUCKET).remove([meta.path]);
    return "Voice notes can be up to 2 minutes.";
  }
  return null;
}

export async function reviewHomeworkSubmission(
  submissionId: string,
  approved: boolean,
  tutorComment: string | null,
  voiceNote: TutorFeedbackAudioMeta | null = null
): Promise<TutorHomeworkActionResult> {
  try {
    const { supabase, userId } = await requireTutorHomeworkAction();
    const feedback = voiceNote ? parseTutorFeedbackAudio(submissionId, voiceNote) : null;
    if (voiceNote && !feedback) return { error: "The voice note could not be saved." };

    if (!approved && !tutorComment?.trim() && !feedback) {
      return { error: "Add a comment or a voice note when suggesting improvement." };
    }

    if (feedback) {
      const fileError = await feedbackFileReady(supabase, feedback);
      if (fileError) return { error: fileError };
    }

    const { data, error } = await supabase
      .from("homework_submissions")
      .update({
        status: "reviewed",
        approved,
        tutor_comment: tutorComment?.trim() || null,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        ...(feedback
          ? {
              tutor_feedback_audio_path: feedback.path,
              tutor_feedback_audio_mime: feedback.mimeType,
              tutor_feedback_audio_duration_seconds: feedback.durationSeconds,
            }
          : {}),
      })
      .eq("id", submissionId)
      .eq("status", "pending_review")
      .select("id");

    if (error) {
      if (feedback) {
        await supabase.storage.from(HOMEWORK_RECORDINGS_BUCKET).remove([feedback.path]);
      }
      return { error: error.message };
    }
    if (!data?.length) {
      if (feedback) {
        await supabase.storage.from(HOMEWORK_RECORDINGS_BUCKET).remove([feedback.path]);
      }
      return { error: "This homework is no longer waiting for review." };
    }

    let notionNote = "";
    if (approved) {
      const { data: submission } = await supabase
        .from("homework_submissions")
        .select("student_id, kid_profile_id, lesson_id")
        .eq("id", submissionId)
        .maybeSingle();
      if (submission?.lesson_id) {
        try {
          const { client: admin } = tryCreateServiceRoleClient();
          const writer = admin ?? supabase;
          const synced = await syncApprovedHomeworkToNotion(writer, {
            studentId: (submission.student_id as string | null) ?? null,
            kidProfileId: (submission.kid_profile_id as string | null) ?? null,
            lessonId: submission.lesson_id as string,
            markedBy: userId,
          });
          notionNote = synced.notionNote;
        } catch (notionError) {
          notionNote = ` Notion sync failed: ${
            notionError instanceof Error ? notionError.message : "unknown error"
          }.`;
        }
      }
    }

    revalidateTutorHomeworkPaths();
    return {
      success: approved
        ? `Homework approved.${notionNote}`
        : "Feedback sent — the student has been notified.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to review homework." };
  }
}

export async function loadHomeworkCohortRoster(
  cohortId: string,
  lessonId: string
): Promise<TutorHomeworkActionResult & { roster: HomeworkCohortRosterStudent[] }> {
  try {
    const { supabase, userId } = await requireTutorHomeworkAction();
    const canManage = await canManageCohort(supabase, userId, cohortId);
    if (!canManage) throw new Error("You are not the tutor for this cohort.");

    const roster = await fetchHomeworkCohortRoster(supabase, cohortId, lessonId);
    return { roster };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to load homework roster.",
      roster: [],
    };
  }
}

export async function setTutorFeedbackAudio(
  submissionId: string,
  voiceNote: TutorFeedbackAudioMeta | null
): Promise<TutorHomeworkActionResult> {
  try {
    const { supabase } = await requireTutorHomeworkAction();
    const feedback = voiceNote ? parseTutorFeedbackAudio(submissionId, voiceNote) : null;
    if (voiceNote && !feedback) return { error: "The voice note could not be saved." };
    if (feedback) {
      const fileError = await feedbackFileReady(supabase, feedback);
      if (fileError) return { error: fileError };
    }

    const { data: existing, error: loadError } = await supabase
      .from("homework_submissions")
      .select("tutor_feedback_audio_path")
      .eq("id", submissionId)
      .eq("status", "reviewed")
      .maybeSingle();
    if (loadError) return { error: loadError.message };
    if (!existing) return { error: "You cannot change this voice note." };

    const previousPath = (existing.tutor_feedback_audio_path as string | null) ?? null;
    const { data, error } = await supabase
      .from("homework_submissions")
      .update({
        tutor_feedback_audio_path: feedback?.path ?? null,
        tutor_feedback_audio_mime: feedback?.mimeType ?? null,
        tutor_feedback_audio_duration_seconds: feedback?.durationSeconds ?? null,
      })
      .eq("id", submissionId)
      .eq("status", "reviewed")
      .select("id");

    if (error) {
      if (feedback) {
        await supabase.storage.from(HOMEWORK_RECORDINGS_BUCKET).remove([feedback.path]);
      }
      return { error: error.message };
    }
    if (!data?.length) {
      if (feedback) {
        await supabase.storage.from(HOMEWORK_RECORDINGS_BUCKET).remove([feedback.path]);
      }
      return { error: "You cannot change this voice note." };
    }

    if (previousPath && previousPath !== feedback?.path) {
      await supabase.storage.from(HOMEWORK_RECORDINGS_BUCKET).remove([previousPath]);
    }

    revalidateTutorHomeworkPaths();
    return { success: feedback ? "Voice note saved." : "Voice note deleted." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "The voice note could not be saved." };
  }
}

export { getHomeworkPlaybackUrl, getTutorFeedbackPlaybackUrl };
