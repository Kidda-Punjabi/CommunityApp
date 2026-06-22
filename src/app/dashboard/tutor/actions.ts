"use server";

import { createClient } from "@/lib/supabase/server";
import { canAccessTutorDashboard, canManageCohort } from "@/lib/tutoring/tutor-access";
import { revalidatePath } from "next/cache";

export type TutorActionResult = {
  error?: string;
  success?: string;
};

function revalidateTutorPaths() {
  revalidatePath("/dashboard/tutor");
  revalidatePath("/dashboard/tutor/student", "layout");
  revalidatePath("/dashboard/tutor/cohort", "layout");
  revalidatePath("/dashboard/learn");
}

async function requireTutorAction(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("You must be signed in.");

  const allowed = await canAccessTutorDashboard(supabase, user.id);
  if (!allowed) throw new Error("Tutor access required.");

  return { supabase, userId: user.id };
}

function normalizeRecordingUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export async function setStudentLessonUnlock(
  studentId: string,
  courseId: string,
  lessonId: string,
  unlocked: boolean
): Promise<TutorActionResult> {
  try {
    const { supabase, userId } = await requireTutorAction();

    const { data: enrollment } = await supabase
      .from("course_enrollments")
      .select("id")
      .eq("tutor_id", userId)
      .eq("user_id", studentId)
      .eq("course_id", courseId)
      .or("delivery_mode.is.null,delivery_mode.eq.one_to_one")
      .maybeSingle();

    if (!enrollment) {
      return { error: "You are not the tutor for this student in this course." };
    }

    if (unlocked) {
      const { error } = await supabase.from("student_lesson_unlocks").upsert(
        {
          student_id: studentId,
          lesson_id: lessonId,
          unlocked_by: userId,
          unlocked_at: new Date().toISOString(),
        },
        { onConflict: "student_id,lesson_id" }
      );
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase
        .from("student_lesson_unlocks")
        .delete()
        .eq("student_id", studentId)
        .eq("lesson_id", lessonId);
      if (error) return { error: error.message };
    }

    revalidateTutorPaths();
    return { success: unlocked ? "Lesson unlocked." : "Lesson locked." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update unlock." };
  }
}

export async function setCohortLessonUnlock(
  cohortId: string,
  lessonId: string,
  unlocked: boolean
): Promise<TutorActionResult> {
  try {
    const { supabase, userId } = await requireTutorAction();

    if (!(await canManageCohort(supabase, userId, cohortId))) {
      return { error: "You are not the tutor for this cohort." };
    }

    if (unlocked) {
      const { error } = await supabase.from("cohort_lesson_unlocks").upsert(
        {
          cohort_id: cohortId,
          lesson_id: lessonId,
          unlocked_by: userId,
          unlocked_at: new Date().toISOString(),
        },
        { onConflict: "cohort_id,lesson_id" }
      );
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase
        .from("cohort_lesson_unlocks")
        .delete()
        .eq("cohort_id", cohortId)
        .eq("lesson_id", lessonId);
      if (error) return { error: error.message };
    }

    revalidateTutorPaths();
    return { success: unlocked ? "Lesson unlocked for cohort." : "Lesson locked for cohort." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update unlock." };
  }
}

export async function saveStudentLessonRecording(
  studentId: string,
  courseId: string,
  lessonId: string,
  recordingUrl: string,
  title?: string
): Promise<TutorActionResult> {
  try {
    const { supabase, userId } = await requireTutorAction();
    const url = normalizeRecordingUrl(recordingUrl);
    if (!url) return { error: "Enter a valid http(s) recording link." };

    const { data: enrollment } = await supabase
      .from("course_enrollments")
      .select("id")
      .eq("tutor_id", userId)
      .eq("user_id", studentId)
      .eq("course_id", courseId)
      .or("delivery_mode.is.null,delivery_mode.eq.one_to_one")
      .maybeSingle();

    if (!enrollment) {
      return { error: "You are not the tutor for this student in this course." };
    }

    const { data: existing } = await supabase
      .from("lesson_recordings")
      .select("id")
      .eq("lesson_id", lessonId)
      .eq("student_id", studentId)
      .maybeSingle();

    const payload = {
      lesson_id: lessonId,
      student_id: studentId,
      cohort_id: null,
      storage_path: url,
      title: title?.trim() || null,
      uploaded_by: userId,
      updated_at: new Date().toISOString(),
    };

    const { error } = existing
      ? await supabase.from("lesson_recordings").update(payload).eq("id", existing.id)
      : await supabase.from("lesson_recordings").insert(payload);

    if (error) return { error: error.message };

    revalidateTutorPaths();
    return { success: "Recording link saved." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save recording." };
  }
}

export async function saveCohortLessonRecording(
  cohortId: string,
  lessonId: string,
  recordingUrl: string,
  title?: string
): Promise<TutorActionResult> {
  try {
    const { supabase, userId } = await requireTutorAction();
    const url = normalizeRecordingUrl(recordingUrl);
    if (!url) return { error: "Enter a valid http(s) recording link." };

    if (!(await canManageCohort(supabase, userId, cohortId))) {
      return { error: "You are not the tutor for this cohort." };
    }

    const { data: existing } = await supabase
      .from("lesson_recordings")
      .select("id")
      .eq("lesson_id", lessonId)
      .eq("cohort_id", cohortId)
      .maybeSingle();

    const payload = {
      lesson_id: lessonId,
      student_id: null,
      cohort_id: cohortId,
      storage_path: url,
      title: title?.trim() || null,
      uploaded_by: userId,
      updated_at: new Date().toISOString(),
    };

    const { error } = existing
      ? await supabase.from("lesson_recordings").update(payload).eq("id", existing.id)
      : await supabase.from("lesson_recordings").insert(payload);

    if (error) return { error: error.message };

    revalidateTutorPaths();
    return { success: "Recording link saved for cohort." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save recording." };
  }
}

export async function removeStudentLessonRecording(
  studentId: string,
  lessonId: string
): Promise<TutorActionResult> {
  try {
    const { supabase, userId } = await requireTutorAction();

    const { data: enrollment } = await supabase
      .from("course_enrollments")
      .select("id")
      .eq("tutor_id", userId)
      .eq("user_id", studentId)
      .limit(1)
      .maybeSingle();

    if (!enrollment) return { error: "Not authorized." };

    const { error } = await supabase
      .from("lesson_recordings")
      .delete()
      .eq("lesson_id", lessonId)
      .eq("student_id", studentId);

    if (error) return { error: error.message };

    revalidateTutorPaths();
    return { success: "Recording removed." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to remove recording." };
  }
}

export async function removeCohortLessonRecording(
  cohortId: string,
  lessonId: string
): Promise<TutorActionResult> {
  try {
    const { supabase, userId } = await requireTutorAction();

    if (!(await canManageCohort(supabase, userId, cohortId))) {
      return { error: "Not authorized." };
    }

    const { error } = await supabase
      .from("lesson_recordings")
      .delete()
      .eq("lesson_id", lessonId)
      .eq("cohort_id", cohortId);

    if (error) return { error: error.message };

    revalidateTutorPaths();
    return { success: "Recording removed." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to remove recording." };
  }
}
