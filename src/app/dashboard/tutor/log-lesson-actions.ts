"use server";

import { createLessonLogInNotionAndSupabase } from "@/lib/notion/lesson-log-sync";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";
import { canAccessTutorDashboard, canManageCohort } from "@/lib/tutoring/tutor-access";
import { revalidatePath } from "next/cache";

export type LogLessonActionResult = {
  error?: string;
  success?: string;
};

export async function logCohortLessonAction(
  formData: FormData
): Promise<LogLessonActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };

  const allowed = await canAccessTutorDashboard(supabase, user.id);
  if (!allowed) return { error: "Tutor access required." };

  const cohortId = String(formData.get("cohort_id") ?? "").trim();
  const lessonDate = String(formData.get("lesson_date") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const recordingUrl = String(formData.get("recording_url") ?? "").trim();

  if (!cohortId) return { error: "Choose a cohort." };
  if (!lessonDate) return { error: "Choose the lesson date." };

  const canManage = await canManageCohort(supabase, user.id, cohortId);
  if (!canManage) {
    console.error("[lesson-log] tutor blocked before insert", {
      userId: user.id,
      cohortId,
      lessonDate,
    });
    return {
      error:
        "You don't have permission to log this lesson. You need to be the assigned tutor for this class, or covering it via an accepted cover request.",
    };
  }

  const { client: adminClient, error: adminError } = tryCreateServiceRoleClient();

  let notionTutorUserId: string | null = null;
  if (adminClient) {
    const { data: tutorMap } = await adminClient
      .from("notion_tutor_map")
      .select("notion_user_id")
      .eq("tutor_id", user.id)
      .maybeSingle();
    notionTutorUserId = tutorMap?.notion_user_id ?? null;
  }

  const result = await createLessonLogInNotionAndSupabase(supabase, {
    cohortId,
    lessonDate,
    notes: notes || null,
    recordingUrl: recordingUrl || null,
    loggedBy: user.id,
    notionTutorUserId,
  });

  if (!result.ok) {
    console.error("[lesson-log] tutor log write failed", {
      userId: user.id,
      cohortId,
      lessonDate,
      error: result.error,
    });
    return { error: result.error };
  }

  revalidatePath("/dashboard/tutor");
  revalidatePath("/dashboard/tutor/log-lesson");
  revalidatePath("/dashboard/tutor/lessons");
  revalidatePath("/admin/packages");
  revalidatePath("/dashboard/learn");

  return {
    success: result.reusedExisting
      ? "This lesson was already logged — updated the existing entry in the app and Notion."
      : "Lesson logged — saved in the app and Notion.",
  };
}
