"use server";

import { createClient } from "@/lib/supabase/server";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import {
  loadHomeworkCohortRoster as fetchHomeworkCohortRoster,
  type HomeworkCohortRosterStudent,
} from "@/lib/tutoring/homework-submissions";
import { syncApprovedHomeworkToNotion } from "@/lib/tutoring/sync-approved-homework-to-notion";
import { canAccessTutorDashboard, canManageCohort } from "@/lib/tutoring/tutor-access";
import { revalidatePath } from "next/cache";
import type { HomeworkActionResult } from "@/app/dashboard/learn/homework-actions";
import { getHomeworkPlaybackUrl } from "@/app/dashboard/learn/homework-actions";

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

export async function reviewHomeworkSubmission(
  submissionId: string,
  approved: boolean,
  tutorComment: string | null
): Promise<TutorHomeworkActionResult> {
  try {
    const { supabase, userId } = await requireTutorHomeworkAction();

    if (!approved && !tutorComment?.trim()) {
      return { error: "Please add a comment when suggesting improvement." };
    }

    const { error } = await supabase
      .from("homework_submissions")
      .update({
        status: "reviewed",
        approved,
        tutor_comment: tutorComment?.trim() || null,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", submissionId)
      .eq("status", "pending_review");

    if (error) return { error: error.message };

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

export { getHomeworkPlaybackUrl };
