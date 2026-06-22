"use server";

import { requireAdminFromActions, type ActionResult } from "@/app/admin/content/actions";
import type { TutorLessonRow } from "@/lib/tutoring/load-tutor-dashboard";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const ADMIN_PATH = "/admin/content";

function revalidateAdmin() {
  revalidatePath(ADMIN_PATH);
}

async function getAdminActorId(): Promise<string> {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user.id;
}

function normalizeRecordingUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

export async function loadAdminCohortLessons(cohortId: string): Promise<{
  cohortName: string;
  courseName: string;
  lessons: TutorLessonRow[];
  error?: string;
}> {
  try {
    const supabase = await requireAdminFromActions();

    const { data: cohort, error: cohortError } = await supabase
      .from("cohorts")
      .select("id, name, course_id, courses(name)")
      .eq("id", cohortId)
      .maybeSingle();

    if (cohortError) return { cohortName: "", courseName: "", lessons: [], error: cohortError.message };
    if (!cohort) return { cohortName: "", courseName: "", lessons: [], error: "Cohort not found." };

    const course = Array.isArray(cohort.courses) ? cohort.courses[0] : cohort.courses;

    const [{ data: lessons }, { data: unlocks }, { data: recordings }] = await Promise.all([
      supabase
        .from("lessons")
        .select("id, lesson_number, title")
        .eq("course_id", cohort.course_id)
        .order("lesson_number"),
      supabase.from("cohort_lesson_unlocks").select("lesson_id").eq("cohort_id", cohortId),
      supabase
        .from("lesson_recordings")
        .select("id, lesson_id, storage_path")
        .eq("cohort_id", cohortId),
    ]);

    const unlockedIds = new Set((unlocks ?? []).map((row) => row.lesson_id));
    const recordingByLesson = new Map(
      (recordings ?? []).map((row) => [row.lesson_id, row] as const)
    );

    return {
      cohortName: cohort.name,
      courseName: course?.name ?? "Beginners",
      lessons: (lessons ?? []).map((lesson) => {
        const recording = recordingByLesson.get(lesson.id);
        return {
          id: lesson.id,
          lessonNumber: lesson.lesson_number,
          title: lesson.title,
          unlocked: unlockedIds.has(lesson.id),
          recordingUrl: recording?.storage_path ?? null,
          recordingId: recording?.id ?? null,
        };
      }),
    };
  } catch (e) {
    return {
      cohortName: "",
      courseName: "",
      lessons: [],
      error: e instanceof Error ? e.message : "Failed to load cohort lessons.",
    };
  }
}

export async function adminSetCohortLessonUnlock(
  cohortId: string,
  lessonId: string,
  unlocked: boolean
): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const adminUserId = await getAdminActorId();

    if (unlocked) {
      const { error } = await supabase.from("cohort_lesson_unlocks").upsert(
        {
          cohort_id: cohortId,
          lesson_id: lessonId,
          unlocked_by: adminUserId,
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

    revalidateAdmin();
    revalidatePath("/dashboard/tutor");
    revalidatePath("/dashboard/learn");
    return { success: unlocked ? "Lesson unlocked for cohort." : "Lesson locked for cohort." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update unlock." };
  }
}

export async function adminSaveCohortLessonRecording(
  cohortId: string,
  lessonId: string,
  recordingUrl: string
): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const adminUserId = await getAdminActorId();
    const url = normalizeRecordingUrl(recordingUrl);
    if (!url) return { error: "Enter a valid http(s) recording link." };

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
      title: null,
      uploaded_by: adminUserId,
      updated_at: new Date().toISOString(),
    };

    const { error } = existing
      ? await supabase.from("lesson_recordings").update(payload).eq("id", existing.id)
      : await supabase.from("lesson_recordings").insert(payload);

    if (error) return { error: error.message };

    revalidateAdmin();
    revalidatePath("/dashboard/tutor");
    revalidatePath("/dashboard/learn");
    return { success: "Recording link saved for cohort." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save recording." };
  }
}

export async function adminRemoveCohortLessonRecording(
  cohortId: string,
  lessonId: string
): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();

    const { error } = await supabase
      .from("lesson_recordings")
      .delete()
      .eq("lesson_id", lessonId)
      .eq("cohort_id", cohortId);

    if (error) return { error: error.message };

    revalidateAdmin();
    revalidatePath("/dashboard/learn");
    return { success: "Recording removed." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to remove recording." };
  }
}
