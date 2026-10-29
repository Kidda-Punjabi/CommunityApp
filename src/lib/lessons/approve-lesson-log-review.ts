import "server-only";

import { unlockLessonForCohort } from "@/lib/lessons/cohort-lesson-unlock";
import { lessonLogUnlockTargets } from "@/lib/lessons/lesson-log-unlock-targets";
import { syncCohortLessonRecordingFromLog } from "@/lib/tutoring/sync-cohort-recording-from-log";
import type { SupabaseClient } from "@supabase/supabase-js";

type ApproveResult = { ok: true; unlockedCount: number } | { ok: false; error: string };

export async function approveLessonLogReview(
  admin: SupabaseClient,
  input: { entryId: string; approvedBy: string }
): Promise<ApproveResult> {
  const { data: entry, error: loadError } = await admin
    .from("cohort_lesson_log_entries")
    .select(
      "id, cohort_id, package_instance_id, lesson_id, status, dismissed_at, needs_review, recording_url"
    )
    .eq("id", input.entryId)
    .maybeSingle();

  if (loadError) return { ok: false, error: loadError.message };
  if (!entry) return { ok: false, error: "Lesson log entry not found." };
  if (entry.dismissed_at) return { ok: false, error: "This lesson log is dismissed." };
  if (entry.status === "Cancelled") {
    return { ok: false, error: "A cancelled lesson cannot be approved for pay." };
  }
  if (!entry.lesson_id) {
    return { ok: false, error: "This lesson log is not linked to a curriculum lesson yet." };
  }
  if (entry.needs_review !== true) {
    return { ok: true, unlockedCount: 0 };
  }

  const lessonId = entry.lesson_id as string;
  let unlockedCount = 0;

  if (entry.cohort_id) {
    const unlocked = await unlockLessonForCohort(admin, {
      cohortId: entry.cohort_id as string,
      lessonId,
      unlockedBy: input.approvedBy,
    });
    if (!unlocked.ok) return { ok: false, error: unlocked.reason };
    unlockedCount = 1;
    await syncCohortLessonRecordingFromLog(admin, {
      cohortId: entry.cohort_id as string,
      lessonId,
      recordingUrl: entry.recording_url as string | null,
      uploadedBy: input.approvedBy,
    });
  } else if (entry.package_instance_id) {
    const packageInstanceId = entry.package_instance_id as string;
    const { data: attendance, error: attendanceError } = await admin
      .from("cohort_lesson_attendance")
      .select("student_id, kid_profile_id")
      .eq("package_instance_id", packageInstanceId)
      .eq("lesson_id", lessonId);
    if (attendanceError) return { ok: false, error: attendanceError.message };

    const { data: links, error: linkError } = await admin
      .from("student_packages")
      .select("user_id")
      .eq("package_instance_id", packageInstanceId)
      .neq("status", "withdrawn");
    if (linkError) return { ok: false, error: linkError.message };

    const targets = lessonLogUnlockTargets({
      attendance: (attendance ?? []) as Array<{
        student_id: string | null;
        kid_profile_id: string | null;
      }>,
      packageStudentIds: [
        ...new Set(
          (links ?? []).map((row) => row.user_id as string | null).filter((id): id is string => Boolean(id))
        ),
      ],
    });

    const now = new Date().toISOString();
    for (const target of targets) {
      const { error } = await admin.from("student_lesson_unlocks").upsert(
        {
          student_id: target.studentId,
          kid_profile_id: target.kidProfileId,
          lesson_id: lessonId,
          unlocked_by: input.approvedBy,
          unlocked_at: now,
        },
        {
          onConflict: target.kidProfileId ? "kid_profile_id,lesson_id" : "student_id,lesson_id",
        }
      );
      if (error) return { ok: false, error: error.message };
      unlockedCount += 1;
    }

    const recordingStudentId = targets.find((target) => target.studentId)?.studentId ?? null;
    const recordingUrl = (entry.recording_url as string | null)?.trim() || "";
    if (recordingUrl && recordingStudentId) {
      const { data: existing } = await admin
        .from("lesson_recordings")
        .select("id")
        .eq("lesson_id", lessonId)
        .eq("student_id", recordingStudentId)
        .maybeSingle();
      const payload = {
        lesson_id: lessonId,
        student_id: recordingStudentId,
        cohort_id: null,
        storage_path: recordingUrl,
        uploaded_by: input.approvedBy,
        lesson_log_entry_id: entry.id,
        updated_at: now,
      };
      const { error: recordingError } = existing
        ? await admin.from("lesson_recordings").update(payload).eq("id", existing.id)
        : await admin.from("lesson_recordings").insert(payload);
      if (recordingError) return { ok: false, error: recordingError.message };
    }
  } else {
    return { ok: false, error: "This lesson log is not linked to a class." };
  }

  const { error: clearError } = await admin
    .from("cohort_lesson_log_entries")
    .update({
      needs_review: false,
      needs_review_reason: null,
      needs_review_approved_by: input.approvedBy,
      needs_review_approved_at: new Date().toISOString(),
    })
    .eq("id", entry.id)
    .eq("needs_review", true);

  if (clearError) return { ok: false, error: clearError.message };
  return { ok: true, unlockedCount };
}
