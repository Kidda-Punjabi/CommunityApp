"use server";

import { revalidatePath } from "next/cache";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";
import { getDisplayName } from "@/lib/profile/display-name";
import { kidProfileIdsInCohort, loadCohortMembershipRoster } from "@/lib/tutoring/cohort-attendance";
import { resolveCoverLessonWrite } from "@/lib/tutoring/cover-lesson";
import type { LessonLogEditAttendance } from "@/lib/tutoring/lesson-log-edit";
import { patchLessonLogRecording, patchLoggedLessonOnNotion, readLessonLogPage, resolvePresentLeads } from "@/lib/tutoring/log-lesson-notion";
import {
  compareLessonLogReadback,
  formatLogNotionTitle,
  isHttpUrl,
  logTitleMatchesLessonNumber,
  londonTimeLabel,
  type ReadbackDifference,
} from "@/lib/tutoring/log-lesson-copy";
import { syncCohortLessonRecordingFromLog } from "@/lib/tutoring/sync-cohort-recording-from-log";
import { canAccessTutorDashboard, canEditTeachingClass } from "@/lib/tutoring/tutor-access";

export type ClassActionResult = {
  error?: string;
  success?: string;
  confirmed?: boolean;
  readAt?: string;
  differences?: ReadbackDifference[];
};

async function requireTutor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");
  const allowed = await canAccessTutorDashboard(supabase, user.id);
  if (!allowed) throw new Error("Tutor access required.");
  const { client: admin } = tryCreateServiceRoleClient();
  return { reader: admin ?? supabase, auth: supabase, userId: user.id };
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

    const { reader, auth, userId } = await requireTutor();
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
      if (!(await canEditTeachingClass(auth, userId, (cohort?.tutor_id as string | null) ?? null))) {
        return { error: "You are not the tutor for this class." };
      }
    } else if (packageInstanceId) {
      const { data: instance } = await reader
        .from("package_instances")
        .select("tutor_id")
        .eq("id", packageInstanceId)
        .maybeSingle();
      if (!(await canEditTeachingClass(auth, userId, (instance?.tutor_id as string | null) ?? null))) {
        return { error: "You are not the tutor for this class." };
      }
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

export async function updateLoggedLessonAction(input: {
  entryId: string;
  lessonId: string;
  lessonDate: string;
  notes: string;
  recordingUrl: string;
  attendance: LessonLogEditAttendance[];
  homeworkSubmittedIds: string[];
  isCoverSession: boolean;
  actualTutorId: string | null;
}): Promise<ClassActionResult> {
  try {
    const lessonDate = input.lessonDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lessonDate)) return { error: "Choose the date you taught." };
    const recordingUrl = input.recordingUrl.trim();
    if (recordingUrl && !isHttpUrl(recordingUrl)) {
      return { error: "Enter a recording link that starts with http or https." };
    }

    const { reader, auth, userId } = await requireTutor();
    const owned = await loadOwnedLessonLog(reader, auth, userId, input.entryId);
    if ("error" in owned) return { error: owned.error };
    const { entry, cohortId, packageInstanceId } = owned;

    const { data: lesson } = await reader
      .from("lessons")
      .select("id, lesson_number, title, course_id")
      .eq("id", input.lessonId)
      .maybeSingle();
    if (!lesson || lesson.course_id !== owned.courseId) {
      return { error: "That lesson is not part of this course." };
    }
    const title = formatLogNotionTitle({
      name: owned.className,
      courseName: owned.courseName,
      lessonNumber: lesson.lesson_number as number,
      lessonDate,
    });
    if (!logTitleMatchesLessonNumber(title, lesson.lesson_number as number)) {
      return { error: "The lesson title does not match the selected lesson." };
    }

    if (input.lessonId !== entry.lesson_id) {
      const clash = cohortId
        ? await reader
            .from("cohort_lesson_log_entries")
            .select("id")
            .eq("cohort_id", cohortId)
            .eq("lesson_id", input.lessonId)
            .is("dismissed_at", null)
            .neq("id", input.entryId)
            .limit(1)
        : await reader
            .from("cohort_lesson_log_entries")
            .select("id")
            .eq("package_instance_id", packageInstanceId)
            .eq("lesson_id", input.lessonId)
            .is("dismissed_at", null)
            .neq("id", input.entryId)
            .limit(1);
      if (clash.data && clash.data.length > 0) {
        return { error: "That lesson is already logged." };
      }
    }

    const cover = await resolveCoverLessonWrite(reader, {
      isCoverSession: input.isCoverSession,
      actualTutorId: input.actualTutorId,
      assignedTutorId: owned.assignedTutorId,
    });
    if (!cover.ok) return { error: cover.error };

    const roster = await classRoster(reader, cohortId, packageInstanceId);
    const allowed = new Map(roster.map((person) => [person.id, person]));
    const marks = input.attendance.filter((person) => allowed.has(person.id));
    if (marks.length === 0) return { error: "Add who attended before saving." };
    const homeworkIds = input.homeworkSubmittedIds.filter((id) => allowed.has(id));

    const { error: updateError } = await reader
      .from("cohort_lesson_log_entries")
      .update({
        lesson_id: input.lessonId,
        lesson_title: title,
        lesson_date: lessonDate,
        notes: input.notes.trim() || null,
        recording_url: recordingUrl || null,
        is_cover_session: cover.isCoverSession,
        actual_tutor_id: cover.actualTutorId,
        actual_tutor_notion_user_id: cover.notionTutorUserId,
        notion_tutor_user_id: cover.notionTutorUserId,
      })
      .eq("id", input.entryId);
    if (updateError) return { error: updateError.message };

    if (input.lessonId !== entry.lesson_id) {
      const moved = await clearLessonRows(reader, cohortId, packageInstanceId, entry.lesson_id);
      if (moved) return { error: moved };
    }

    const attendanceError = await writeAttendance(reader, {
      userId,
      cohortId,
      packageInstanceId,
      lessonId: input.lessonId,
      marks,
    });
    if (attendanceError) return { error: attendanceError };

    const homeworkError = await writeHomeworkMarks(reader, {
      userId,
      cohortId,
      lessonId: input.lessonId,
      marks: roster.map((person) => ({
        ...person,
        completed: homeworkIds.includes(person.id),
      })),
    });
    if (homeworkError) return { error: homeworkError };

    const unlockError = await writeUnlock(reader, {
      userId,
      cohortId,
      packageInstanceId,
      previousLessonId: entry.lesson_id,
      lessonId: input.lessonId,
      marks,
    });
    if (unlockError) return { error: unlockError };

    const recordingError = await syncRecording(reader, {
      userId,
      cohortId,
      packageInstanceId,
      lessonId: input.lessonId,
      entryId: input.entryId,
      recordingUrl,
    });
    if (recordingError) return { error: recordingError };

    const pageId = entry.notion_page_id?.trim() ?? "";
    if (!pageId || pageId.startsWith("pending-")) {
      refreshClassPaths(cohortId, packageInstanceId);
      return { success: "Updated in the app. This lesson has no Notion page yet.", confirmed: false, readAt: londonTimeLabel() };
    }

    const present = marks
      .filter((person) => person.attended)
      .map((person) => ({
        studentId: person.kind === "student" ? person.id : null,
        kidProfileId: person.kind === "kid" ? person.id : null,
        name: allowed.get(person.id)?.name || person.name,
      }));
    const leads = await resolvePresentLeads(reader, present);
    const submitted = roster
      .filter((person) => homeworkIds.includes(person.id))
      .map((person) => ({
        studentId: person.kind === "student" ? person.id : null,
        kidProfileId: person.kind === "kid" ? person.id : null,
        name: person.name,
      }));
    const homeworkLeads = await resolvePresentLeads(reader, submitted);
    const replaceAttendees = present.length === 0 || leads.leadIds.length > 0;
    const replaceHomework = submitted.length === 0 || homeworkLeads.leadIds.length > 0;
    try {
      await patchLoggedLessonOnNotion({
        pageId,
        title,
        lessonDate,
        notes: input.notes.trim(),
        recordingUrl: recordingUrl || null,
        isCoverSession: cover.isCoverSession,
        notionTutorUserId: cover.notionTutorUserId,
        attendeeLeadIds: replaceAttendees ? leads.leadIds : null,
        homeworkLeadIds: replaceHomework ? homeworkLeads.leadIds : null,
      });
    } catch (notionError) {
      await reader
        .from("cohort_lesson_log_entries")
        .update({
          notion_sync_status: "error",
          notion_sync_error: "Notion lesson log was not updated.",
          notion_synced_at: null,
        })
        .eq("id", input.entryId);
      refreshClassPaths(cohortId, packageInstanceId);
      const message = notionError instanceof Error ? notionError.message : "Notion could not be updated.";
      return { error: `Updated in the app. Notion lesson log was not updated: ${message}` };
    }

    const absentNames = marks.filter((person) => !person.attended).map((person) => person.name);
    const readback = await readLessonLogPage({
      pageId,
      expectedTutorUserId: cover.notionTutorUserId,
      absentNames,
    });
    const differences = compareLessonLogReadback({
      submittedTitle: title,
      submittedDate: lessonDate,
      submittedLesson: title.match(/\b(?:Week|Lesson) \d+\b/)?.[0] ?? title,
      submittedRecordingUrl: recordingUrl,
      submittedPresentNames: present.map((person) => person.name),
      submittedAbsentNames: absentNames,
      actual: readback,
      unmatchedPresentNames: leads.unmatchedNames,
      expectedLeadIds: replaceAttendees ? leads.leadIds : undefined,
      expectedCoverSession: cover.isCoverSession,
      expectedNotionTutorUserId: cover.notionTutorUserId,
    });
    const confirmed = differences.length === 0;
    await reader
      .from("cohort_lesson_log_entries")
      .update({
        notion_sync_status: confirmed ? "synced" : "error",
        notion_sync_error: confirmed ? null : "Notion read-back did not match what was saved.",
        notion_synced_at: confirmed ? new Date().toISOString() : null,
      })
      .eq("id", input.entryId);
    refreshClassPaths(cohortId, packageInstanceId);
    return {
      success: confirmed ? "Updated. Notion matches this lesson." : "Updated. Notion needs a check.",
      confirmed,
      readAt: londonTimeLabel(),
      differences,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update the lesson." };
  }
}

async function loadOwnedLessonLog(
  reader: Awaited<ReturnType<typeof requireTutor>>["reader"],
  auth: Awaited<ReturnType<typeof requireTutor>>["auth"],
  userId: string,
  entryId: string
): Promise<
  | {
      entry: {
        lesson_id: string;
        notion_page_id: string | null;
      };
      cohortId: string | null;
      packageInstanceId: string | null;
      courseId: string;
      courseName: string;
      className: string;
      assignedTutorId: string | null;
    }
  | { error: string }
> {
  const { data: entry, error } = await reader
    .from("cohort_lesson_log_entries")
    .select("id, cohort_id, package_instance_id, lesson_id, notion_page_id")
    .eq("id", entryId)
    .maybeSingle();
  if (error || !entry?.lesson_id) return { error: "That lesson log could not be found." };

  const cohortId = (entry.cohort_id as string | null) ?? null;
  const packageInstanceId = (entry.package_instance_id as string | null) ?? null;
  let assignedTutorId: string | null = null;
  let courseId = "";
  let courseName = "Course";
  let className = "Class";
  if (cohortId) {
    const { data: cohort } = await reader
      .from("cohorts")
      .select("tutor_id, name, course_id, courses(name)")
      .eq("id", cohortId)
      .maybeSingle();
    if (!cohort) return { error: "That class could not be found." };
    assignedTutorId = (cohort.tutor_id as string | null) ?? null;
    if (!(await canEditTeachingClass(auth, userId, assignedTutorId))) {
      return { error: "You are not the tutor for this class." };
    }
    courseId = cohort.course_id as string;
    className = (cohort.name as string) || "Cohort";
    const course = Array.isArray(cohort.courses) ? cohort.courses[0] : cohort.courses;
    courseName = (course as { name?: string } | null)?.name ?? "Course";
  } else if (packageInstanceId) {
    const { data: instance } = await reader
      .from("package_instances")
      .select("tutor_id, name, course_id, courses(name)")
      .eq("id", packageInstanceId)
      .maybeSingle();
    if (!instance) return { error: "That class could not be found." };
    assignedTutorId = (instance.tutor_id as string | null) ?? null;
    if (!(await canEditTeachingClass(auth, userId, assignedTutorId))) {
      return { error: "You are not the tutor for this class." };
    }
    courseId = instance.course_id as string;
    className = (instance.name as string) || "Student";
    const course = Array.isArray(instance.courses) ? instance.courses[0] : instance.courses;
    courseName = (course as { name?: string } | null)?.name ?? "Course";
  } else {
    return { error: "That lesson log is not attached to a class." };
  }

  return {
    entry: {
      lesson_id: entry.lesson_id as string,
      notion_page_id: (entry.notion_page_id as string | null) ?? null,
    },
    cohortId,
    packageInstanceId,
    courseId,
    courseName,
    className,
    assignedTutorId,
  };
}

async function clearLessonRows(
  reader: Awaited<ReturnType<typeof requireTutor>>["reader"],
  cohortId: string | null,
  packageInstanceId: string | null,
  lessonId: string
): Promise<string | null> {
  const attendance = cohortId
    ? await reader.from("cohort_lesson_attendance").delete().eq("cohort_id", cohortId).eq("lesson_id", lessonId)
    : await reader
        .from("cohort_lesson_attendance")
        .delete()
        .eq("package_instance_id", packageInstanceId)
        .eq("lesson_id", lessonId);
  if (attendance.error) return attendance.error.message;
  if (cohortId) {
    const homework = await reader
      .from("cohort_lesson_homework")
      .delete()
      .eq("cohort_id", cohortId)
      .eq("lesson_id", lessonId);
    if (homework.error) return homework.error.message;
  }
  return null;
}

async function writeHomeworkMarks(
  reader: Awaited<ReturnType<typeof requireTutor>>["reader"],
  input: {
    userId: string;
    cohortId: string | null;
    lessonId: string;
    marks: Array<LessonLogEditAttendance & { completed: boolean }>;
  }
): Promise<string | null> {
  if (!input.cohortId) return null;
  for (const mark of input.marks) {
    const payload = {
      cohort_id: input.cohortId,
      lesson_id: input.lessonId,
      student_id: mark.kind === "student" ? mark.id : null,
      kid_profile_id: mark.kind === "kid" ? mark.id : null,
      completed: mark.completed,
      marked_by: input.userId,
      marked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const existing = mark.kind === "kid"
      ? await reader
          .from("cohort_lesson_homework")
          .select("id")
          .eq("cohort_id", input.cohortId)
          .eq("lesson_id", input.lessonId)
          .eq("kid_profile_id", mark.id)
          .maybeSingle()
      : await reader
          .from("cohort_lesson_homework")
          .select("id")
          .eq("cohort_id", input.cohortId)
          .eq("lesson_id", input.lessonId)
          .eq("student_id", mark.id)
          .maybeSingle();
    const write = existing.data?.id
      ? await reader.from("cohort_lesson_homework").update(payload).eq("id", existing.data.id)
      : await reader.from("cohort_lesson_homework").insert(payload);
    if (write.error) return write.error.message;
  }
  return null;
}

async function writeUnlock(
  reader: Awaited<ReturnType<typeof requireTutor>>["reader"],
  input: {
    userId: string;
    cohortId: string | null;
    packageInstanceId: string | null;
    previousLessonId: string;
    lessonId: string;
    marks: LessonLogEditAttendance[];
  }
): Promise<string | null> {
  if (input.cohortId) {
    const { error } = await reader.from("cohort_lesson_unlocks").upsert(
      {
        cohort_id: input.cohortId,
        lesson_id: input.lessonId,
        unlocked_by: input.userId,
        unlocked_at: new Date().toISOString(),
      },
      { onConflict: "cohort_id,lesson_id" }
    );
    if (error) return error.message;
    if (input.previousLessonId !== input.lessonId) {
      const { data: stillUsed } = await reader
        .from("cohort_lesson_log_entries")
        .select("id")
        .eq("cohort_id", input.cohortId)
        .eq("lesson_id", input.previousLessonId)
        .is("dismissed_at", null)
        .limit(1);
      if (!stillUsed?.length) {
        await reader
          .from("cohort_lesson_unlocks")
          .delete()
          .eq("cohort_id", input.cohortId)
          .eq("lesson_id", input.previousLessonId);
      }
    }
    return null;
  }
  for (const mark of input.marks) {
    const { error } = await reader.from("student_lesson_unlocks").upsert(
      {
        student_id: mark.kind === "student" ? mark.id : null,
        kid_profile_id: mark.kind === "kid" ? mark.id : null,
        lesson_id: input.lessonId,
        unlocked_by: input.userId,
        unlocked_at: new Date().toISOString(),
      },
      { onConflict: mark.kind === "kid" ? "kid_profile_id,lesson_id" : "student_id,lesson_id" }
    );
    if (error) return error.message;
  }
  return null;
}

async function classRoster(
  reader: Awaited<ReturnType<typeof requireTutor>>["reader"],
  cohortId: string | null,
  packageInstanceId: string | null
): Promise<LessonLogEditAttendance[]> {
  if (cohortId) {
    const [roster, kids] = await Promise.all([
      loadCohortMembershipRoster(reader, cohortId),
      kidProfileIdsInCohort(reader, cohortId),
    ]);
    return roster
      .filter((student) => student.isActiveMember)
      .map((student) => ({
        id: student.studentId,
        name: student.studentName,
        kind: kids.has(student.studentId) ? "kid" : "student",
        attended: true,
      }));
  }
  if (!packageInstanceId) return [];
  const { data: links } = await reader
    .from("student_packages")
    .select("user_id")
    .eq("package_instance_id", packageInstanceId)
    .neq("status", "withdrawn")
    .limit(1);
  const parentId = (links?.[0]?.user_id as string | null) ?? null;
  if (!parentId) return [];
  const { data: instance } = await reader
    .from("package_instances")
    .select("course_id, tutor_id")
    .eq("id", packageInstanceId)
    .maybeSingle();
  if (!instance) return [];
  const { data: enrollment } = await reader
    .from("course_enrollments")
    .select("kid_profile_id, delivery_mode")
    .eq("user_id", parentId)
    .eq("course_id", instance.course_id)
    .eq("tutor_id", instance.tutor_id)
    .maybeSingle();
  const kidProfileId =
    enrollment && enrollment.delivery_mode !== "group"
      ? ((enrollment.kid_profile_id as string | null) ?? null)
      : null;
  if (kidProfileId) {
    const { data: kid } = await reader.from("kid_profiles").select("name").eq("id", kidProfileId).maybeSingle();
    return [{ id: kidProfileId, name: kid?.name?.trim() || "Student", kind: "kid", attended: true }];
  }
  const { data: profile } = await reader
    .from("profiles")
    .select("full_name, preferred_name")
    .eq("id", parentId)
    .maybeSingle();
  return [{ id: parentId, name: getDisplayName(profile) || "Student", kind: "student", attended: true }];
}

async function writeAttendance(
  reader: Awaited<ReturnType<typeof requireTutor>>["reader"],
  input: {
    userId: string;
    cohortId: string | null;
    packageInstanceId: string | null;
    lessonId: string;
    marks: LessonLogEditAttendance[];
  }
): Promise<string | null> {
  const query = input.cohortId
    ? reader
        .from("cohort_lesson_attendance")
        .select("id, student_id, kid_profile_id")
        .eq("cohort_id", input.cohortId)
        .eq("lesson_id", input.lessonId)
    : reader
        .from("cohort_lesson_attendance")
        .select("id, student_id, kid_profile_id")
        .eq("package_instance_id", input.packageInstanceId)
        .eq("lesson_id", input.lessonId);
  const { data: existing, error } = await query;
  if (error) return error.message;

  for (const mark of input.marks) {
    const row = (existing ?? []).find((item) =>
      mark.kind === "kid" ? item.kid_profile_id === mark.id : item.student_id === mark.id && !item.kid_profile_id
    );
    if (row?.id) {
      const { error: updateError } = await reader
        .from("cohort_lesson_attendance")
        .update({
          attended: mark.attended,
          marked_by: input.userId,
          marked_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (updateError) return updateError.message;
      continue;
    }
    const { error: insertError } = await reader.from("cohort_lesson_attendance").insert({
      cohort_id: input.cohortId,
      package_instance_id: input.packageInstanceId,
      lesson_id: input.lessonId,
      student_id: mark.kind === "student" ? mark.id : null,
      kid_profile_id: mark.kind === "kid" ? mark.id : null,
      attended: mark.attended,
      marked_by: input.userId,
    });
    if (insertError) return insertError.message;
  }
  return null;
}

async function syncRecording(
  reader: Awaited<ReturnType<typeof requireTutor>>["reader"],
  input: {
    userId: string;
    cohortId: string | null;
    packageInstanceId: string | null;
    lessonId: string;
    entryId: string;
    recordingUrl: string;
  }
): Promise<string | null> {
  if (input.cohortId) {
    await syncCohortLessonRecordingFromLog(reader, {
      cohortId: input.cohortId,
      lessonId: input.lessonId,
      recordingUrl: input.recordingUrl || null,
      uploadedBy: input.userId,
    });
    return null;
  }
  if (!input.packageInstanceId) return null;
  const { data: link } = await reader
    .from("student_packages")
    .select("user_id")
    .eq("package_instance_id", input.packageInstanceId)
    .neq("status", "withdrawn")
    .limit(1)
    .maybeSingle();
  const studentId = (link?.user_id as string | null) ?? null;
  if (!studentId) return null;
  const { data: existing } = await reader
    .from("lesson_recordings")
    .select("id")
    .eq("lesson_id", input.lessonId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (!input.recordingUrl) {
    if (existing?.id) {
      const { error } = await reader.from("lesson_recordings").delete().eq("id", existing.id);
      if (error) return error.message;
    }
    return null;
  }
  const payload = {
    lesson_id: input.lessonId,
    student_id: studentId,
    cohort_id: null,
    storage_path: input.recordingUrl,
    uploaded_by: input.userId,
    lesson_log_entry_id: input.entryId,
    updated_at: new Date().toISOString(),
  };
  const recordingWrite = existing?.id
    ? await reader.from("lesson_recordings").update(payload).eq("id", existing.id)
    : await reader.from("lesson_recordings").insert(payload);
  return recordingWrite.error?.message ?? null;
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
