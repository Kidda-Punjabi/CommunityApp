"use server";

import { createClient } from "@/lib/supabase/server";
import { canAccessTutorDashboard } from "@/lib/tutoring/tutor-access";
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

    revalidateTutorHomeworkPaths();
    return {
      success: approved
        ? "Homework approved."
        : "Feedback sent — the student has been notified.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to review homework." };
  }
}

export { getHomeworkPlaybackUrl };
