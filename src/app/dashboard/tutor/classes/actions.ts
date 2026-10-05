"use server";

import { revalidatePath } from "next/cache";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";
import { patchLessonLogRecording } from "@/lib/tutoring/log-lesson-notion";
import { isHttpUrl } from "@/lib/tutoring/log-lesson-copy";
import { syncCohortLessonRecordingFromLog } from "@/lib/tutoring/sync-cohort-recording-from-log";
import { canAccessTutorDashboard } from "@/lib/tutoring/tutor-access";

export type ClassActionResult = { error?: string; success?: string };

async function requireTutor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");
  const allowed = await canAccessTutorDashboard(supabase, user.id);
  if (!allowed) throw new Error("Tutor access required.");
  const { client: admin } = tryCreateServiceRoleClient();
  return { reader: admin ?? supabase, userId: user.id };
}

function refreshClassPaths(cohortId: string | null, packageInstanceId: string | null) {
  revalidatePath("/dashboard/tutor");
  revalidatePath("/dashboard/tutor/classes");
  if (cohortId) revalidatePath(`/dashboard/tutor/cohort/${cohortId}`);
  if (packageInstanceId) revalidatePath(`/dashboard/tutor/classes/student/${packageInstanceId}`);
}

export async function saveClassRecordingAction(entryId: string, recordingUrl: string): Promise<ClassActionResult> {
  try {
    const url = recordingUrl.trim();
    if (!isHttpUrl(url)) return { error: "Enter a recording link that starts with http or https." };

    const { reader, userId } = await requireTutor();
    const { data: entry, error } = await reader
      .from("cohort_lesson_log_entries")
      .select("id, cohort_id, package_instance_id, lesson_id, notion_page_id")
      .eq("id", entryId)
      .maybeSingle();
    if (error || !entry?.lesson_id) return { error: "That lesson log could not be found." };

    const cohortId = (entry.cohort_id as string | null) ?? null;
    const packageInstanceId = (entry.package_instance_id as string | null) ?? null;
    if (cohortId) {
      const { data: cohort } = await reader
        .from("cohorts")
        .select("tutor_id")
        .eq("id", cohortId)
        .maybeSingle();
      if (cohort?.tutor_id !== userId) return { error: "You are not the tutor for this class." };
    } else if (packageInstanceId) {
      const { data: instance } = await reader
        .from("package_instances")
        .select("tutor_id")
        .eq("id", packageInstanceId)
        .maybeSingle();
      if (instance?.tutor_id !== userId) return { error: "You are not the tutor for this class." };
    } else {
      return { error: "That lesson log is not attached to a class." };
    }

    const { error: updateError } = await reader
      .from("cohort_lesson_log_entries")
      .update({ recording_url: url })
      .eq("id", entryId);
    if (updateError) return { error: updateError.message };

    if (cohortId) {
      await syncCohortLessonRecordingFromLog(reader, {
        cohortId,
        lessonId: entry.lesson_id as string,
        recordingUrl: url,
        uploadedBy: userId,
      });
    } else if (packageInstanceId) {
      const { data: link } = await reader
        .from("student_packages")
        .select("user_id")
        .eq("package_instance_id", packageInstanceId)
        .neq("status", "withdrawn")
        .limit(1)
        .maybeSingle();
      const studentId = (link?.user_id as string | null) ?? null;
      if (studentId) {
        const { data: existing } = await reader
          .from("lesson_recordings")
          .select("id")
          .eq("lesson_id", entry.lesson_id as string)
          .eq("student_id", studentId)
          .maybeSingle();
        const payload = {
          lesson_id: entry.lesson_id as string,
          student_id: studentId,
          cohort_id: null,
          storage_path: url,
          uploaded_by: userId,
          lesson_log_entry_id: entryId,
          updated_at: new Date().toISOString(),
        };
        const recordingWrite = existing?.id
          ? await reader.from("lesson_recordings").update(payload).eq("id", existing.id)
          : await reader.from("lesson_recordings").insert(payload);
        if (recordingWrite.error) return { error: recordingWrite.error.message };
      }
    }

    const pageId = (entry.notion_page_id as string | null) ?? "";
    if (pageId && !pageId.startsWith("pending-")) {
      try {
        await patchLessonLogRecording(pageId, url);
      } catch (notionError) {
        refreshClassPaths(cohortId, packageInstanceId);
        const message = notionError instanceof Error ? notionError.message : "Notion could not be updated.";
        return { error: `Saved in the app. Notion recording was not updated: ${message}` };
      }
    }

    refreshClassPaths(cohortId, packageInstanceId);
    return { success: "Recording saved." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the recording." };
  }
}

export async function unlockKidLessonEarlyAction(
  packageInstanceId: string,
  kidProfileId: string,
  lessonId: string
): Promise<ClassActionResult> {
  try {
    const { reader, userId } = await requireTutor();
    const { data: instance } = await reader
      .from("package_instances")
      .select("tutor_id, course_id")
      .eq("id", packageInstanceId)
      .maybeSingle();
    if (!instance || instance.tutor_id !== userId) return { error: "You are not the tutor for this class." };

    const { data: kid } = await reader
      .from("kid_profiles")
      .select("parent_user_id")
      .eq("id", kidProfileId)
      .maybeSingle();
    const parentId = (kid?.parent_user_id as string | null) ?? null;
    if (!parentId) return { error: "That student could not be found." };

    const { data: enrollment } = await reader
      .from("course_enrollments")
      .select("id")
      .eq("user_id", parentId)
      .eq("course_id", instance.course_id)
      .eq("tutor_id", userId)
      .eq("kid_profile_id", kidProfileId)
      .maybeSingle();
    if (!enrollment) return { error: "You are not the tutor for this student." };

    const { error } = await reader.from("student_lesson_unlocks").upsert(
      {
        student_id: null,
        kid_profile_id: kidProfileId,
        lesson_id: lessonId,
        unlocked_by: userId,
        unlocked_at: new Date().toISOString(),
      },
      { onConflict: "kid_profile_id,lesson_id" }
    );
    if (error) return { error: error.message };

    refreshClassPaths(null, packageInstanceId);
    return { success: "Lesson unlocked." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not unlock the lesson." };
  }
}
