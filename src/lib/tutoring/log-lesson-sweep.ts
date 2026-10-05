import "server-only";

import { getDisplayName } from "@/lib/profile/display-name";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { resolveCoverLessonWrite } from "@/lib/tutoring/cover-lesson";
import {
  compareLessonLogReadback,
  formatLogNotionTitle,
  isActiveTeachingClass,
  isFoundationalCourse,
  isHttpUrl,
  lessonSlotLabel,
  logTitleMatchesLessonNumber,
  londonTimeLabel,
  type LessonLogReadback,
  type ReadbackDifference,
} from "@/lib/tutoring/log-lesson-copy";
import {
  appendAttendeeRelation,
  createLessonLogPage,
  readLessonLogPage,
  resolvePresentLeads,
  type PresentStudent,
} from "@/lib/tutoring/log-lesson-notion";
import { canManageCohort } from "@/lib/tutoring/tutor-access";
import type { SupabaseClient } from "@supabase/supabase-js";

export type LogAttendanceMark = {
  id: string;
  kind: "student" | "kid";
  name: string;
  attended: boolean;
};

export type LogLessonSweepInput = {
  kind: "group" | "one_to_one";
  cohortId?: string;
  packageInstanceId?: string;
  lessonId: string;
  lessonDate: string;
  recordingUrl: string;
  notes: string;
  attendance: LogAttendanceMark[];
  isCoverSession?: boolean;
  actualTutorId?: string | null;
};

export type LogLessonSweepResult = {
  ok: boolean;
  error?: string;
  entryId: string | null;
  headline: string;
  slotLabel: string;
  targetName: string;
  unlockedCount: number;
  readback: LessonLogReadback | null;
  differences: ReadbackDifference[];
  confirmed: boolean;
  readAt: string;
  notionError: string | null;
};

type TargetContext = {
  cohortId: string | null;
  packageInstanceId: string | null;
  targetName: string;
  courseName: string;
  packageNotionPageId: string;
  lessonNumber: number;
  lessonTitle: string;
  recordingStudentId: string | null;
  assignedTutorId: string | null;
};

function emptyResult(error: string): LogLessonSweepResult {
  return {
    ok: false,
    error,
    entryId: null,
    headline: "",
    slotLabel: "",
    targetName: "",
    unlockedCount: 0,
    readback: null,
    differences: [],
    confirmed: false,
    readAt: londonTimeLabel(),
    notionError: null,
  };
}

function dateOnly(value: string): string | null {
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

async function loadTarget(
  admin: SupabaseClient,
  userClient: SupabaseClient,
  userId: string,
  input: LogLessonSweepInput
): Promise<{ ok: true; target: TargetContext } | { ok: false; error: string }> {
  const cover = input.isCoverSession === true;
  if (input.kind === "group") {
    const cohortId = input.cohortId?.trim() ?? "";
    if (!cohortId) return { ok: false, error: "Choose a cohort." };

    const { data: cohort } = await admin
      .from("cohorts")
      .select("id, name, course_id, tutor_id, notion_page_id, status, active, courses(name)")
      .eq("id", cohortId)
      .maybeSingle();
    if (!cohort) return { ok: false, error: "That cohort could not be found." };
    if (cover) {
      if (
        !isActiveTeachingClass({
          name: cohort.name as string,
          active: cohort.active as boolean | null,
          status: cohort.status as string | null,
        })
      ) {
        return { ok: false, error: "That class is not active." };
      }
    } else {
      const allowed = await canManageCohort(userClient, userId, cohortId);
      if (!allowed) return { ok: false, error: "You are not the tutor for this cohort." };
    }
    const course = Array.isArray(cohort.courses) ? cohort.courses[0] : cohort.courses;
    const courseName = (course as { name?: string } | null)?.name ?? "Course";
    const notionPageId = (cohort.notion_page_id as string | null)?.trim() ?? "";
    if (!notionPageId) {
      return { ok: false, error: "This cohort is not linked to a Notion package yet." };
    }
    const lesson = await loadLesson(admin, input.lessonId, cohort.course_id as string);
    if (!lesson) return { ok: false, error: "That lesson is not part of this course." };
    return {
      ok: true,
      target: {
        cohortId,
        packageInstanceId: null,
        targetName: (cohort.name as string) || "Cohort",
        courseName,
        packageNotionPageId: notionPageId,
        lessonNumber: lesson.lesson_number,
        lessonTitle: lesson.title,
        recordingStudentId: null,
        assignedTutorId: (cohort.tutor_id as string | null) ?? null,
      },
    };
  }

  const packageInstanceId = input.packageInstanceId?.trim() ?? "";
  if (!packageInstanceId) return { ok: false, error: "Choose a student." };
  const { data: instance } = await admin
    .from("package_instances")
    .select("id, name, tutor_id, course_id, notion_page_id, status, active, courses(name)")
    .eq("id", packageInstanceId)
    .maybeSingle();
  if (!instance) return { ok: false, error: "That student could not be found." };
  if (cover) {
    if (
      !isActiveTeachingClass({
        name: (instance.name as string) || "Package",
        active: instance.active as boolean | null,
        status: instance.status as string | null,
      })
    ) {
      return { ok: false, error: "That class is not active." };
    }
  } else if (instance.tutor_id !== userId) {
    return { ok: false, error: "You are not the tutor for this student." };
  }
  const notionPageId = (instance.notion_page_id as string | null)?.trim() ?? "";
  if (!notionPageId) {
    return { ok: false, error: "This 1-1 package is not linked to Notion yet." };
  }
  const course = Array.isArray(instance.courses) ? instance.courses[0] : instance.courses;
  const courseName = (course as { name?: string } | null)?.name ?? "Course";
  const lesson = await loadLesson(admin, input.lessonId, instance.course_id as string);
  if (!lesson) return { ok: false, error: "That lesson is not part of this course." };

  const mark = input.attendance[0];
  const studentName = mark?.name?.trim() || "Student";
  const { data: link } = await admin
    .from("student_packages")
    .select("user_id")
    .eq("package_instance_id", packageInstanceId)
    .neq("status", "withdrawn")
    .limit(1)
    .maybeSingle();

  return {
    ok: true,
    target: {
      cohortId: null,
      packageInstanceId,
      targetName: studentName,
      courseName,
      packageNotionPageId: notionPageId,
      lessonNumber: lesson.lesson_number,
      lessonTitle: lesson.title,
      recordingStudentId: (link?.user_id as string | null) ?? null,
      assignedTutorId: (instance.tutor_id as string | null) ?? null,
    },
  };
}

async function loadLesson(
  admin: SupabaseClient,
  lessonId: string,
  courseId: string
): Promise<{ lesson_number: number; title: string } | null> {
  const { data } = await admin
    .from("lessons")
    .select("lesson_number, title, course_id")
    .eq("id", lessonId)
    .maybeSingle();
  if (!data || data.course_id !== courseId) return null;
  return { lesson_number: data.lesson_number as number, title: data.title as string };
}

function attendancePayload(input: LogLessonSweepInput) {
  return input.attendance.map((mark) => ({
    studentId: mark.kind === "student" ? mark.id : null,
    kidProfileId: mark.kind === "kid" ? mark.id : null,
    attended: mark.attended,
    name: mark.name,
  }));
}

async function pushNotionForEntry(
  admin: SupabaseClient,
  entryId: string
): Promise<{
  readback: LessonLogReadback | null;
  differences: ReadbackDifference[];
  notionError: string | null;
  confirmed: boolean;
}> {
  const { data: entry } = await admin
    .from("cohort_lesson_log_entries")
    .select(
      "id, cohort_id, package_instance_id, lesson_id, lesson_title, lesson_date, recording_url, notes, notion_page_id, notion_tutor_user_id, is_cover_session, logged_by"
    )
    .eq("id", entryId)
    .maybeSingle();
  if (!entry) {
    return {
      readback: null,
      differences: [],
      notionError: "The saved lesson could not be reloaded.",
      confirmed: false,
    };
  }

  const { data: scopedAttendance } = entry.cohort_id
    ? await admin
        .from("cohort_lesson_attendance")
        .select("student_id, kid_profile_id, attended")
        .eq("cohort_id", entry.cohort_id)
        .eq("lesson_id", entry.lesson_id)
    : await admin
        .from("cohort_lesson_attendance")
        .select("student_id, kid_profile_id, attended")
        .eq("package_instance_id", entry.package_instance_id)
        .eq("lesson_id", entry.lesson_id);

  const ids = [
    ...new Set(
      (scopedAttendance ?? [])
        .flatMap((row) => [row.student_id, row.kid_profile_id])
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const [{ data: profiles }, { data: kids }] = await Promise.all([
    ids.length
      ? admin.from("profiles").select("id, full_name, preferred_name").in("id", ids)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; preferred_name: string | null }> }),
    ids.length
      ? admin.from("kid_profiles").select("id, name").in("id", ids)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string | null }> }),
  ]);
  const nameById = new Map<string, string>();
  for (const profile of profiles ?? []) {
    const name = getDisplayName(profile);
    if (name) nameById.set(profile.id, name);
  }
  for (const kid of kids ?? []) {
    if (kid.name?.trim()) nameById.set(kid.id, kid.name.trim());
  }

  const present: PresentStudent[] = [];
  const absentNames: string[] = [];
  for (const row of scopedAttendance ?? []) {
    const id = (row.kid_profile_id as string | null) ?? (row.student_id as string | null);
    const name = (id && nameById.get(id)) || "Student";
    if (row.attended) {
      present.push({
        studentId: (row.student_id as string | null) ?? null,
        kidProfileId: (row.kid_profile_id as string | null) ?? null,
        name,
      });
    } else {
      absentNames.push(name);
    }
  }

  const packageNotionPageId = await packagePageId(admin, entry.cohort_id, entry.package_instance_id);
  if (!packageNotionPageId) {
    const message = "No Notion package is linked, so the page could not be created.";
    await markNotion(admin, entryId, null, "error", message);
    return { readback: null, differences: [], notionError: message, confirmed: false };
  }

  let pageId = String(entry.notion_page_id ?? "");
  const pending = pageId.startsWith("pending-");
  try {
    if (pending) {
      pageId = await createLessonLogPage({
        title: entry.lesson_title as string,
        lessonDate: String(entry.lesson_date).slice(0, 10),
        packageNotionPageId,
        notes: (entry.notes as string | null) ?? null,
        recordingUrl: (entry.recording_url as string | null) ?? null,
        notionTutorUserId: (entry.notion_tutor_user_id as string | null) ?? null,
        isCoverSession: Boolean(entry.is_cover_session),
      });
      await admin
        .from("cohort_lesson_log_entries")
        .update({ notion_page_id: pageId })
        .eq("id", entryId);
    }

    const leads = await resolvePresentLeads(admin, present);
    const appended = await appendAttendeeRelation(pageId, leads.leadIds);
    const dropped = appended.before.filter(
      (id) => !appended.after.some((kept) => kept.replace(/-/g, "") === id.replace(/-/g, ""))
    );
    const expectedTutorUserId = ((entry.notion_tutor_user_id as string | null) ?? "").trim() || null;
    const readback = await readLessonLogPage({
      pageId,
      expectedTutorUserId,
      absentNames,
    });
    const submittedLesson = lessonTokenFromTitle(entry.lesson_title as string);
    const differences = compareLessonLogReadback({
      submittedTitle: entry.lesson_title as string,
      submittedDate: String(entry.lesson_date).slice(0, 10),
      submittedLesson,
      submittedRecordingUrl: (entry.recording_url as string | null) ?? "",
      submittedPresentNames: present.map((student) => student.name),
      submittedAbsentNames: absentNames,
      actual: readback,
      unmatchedPresentNames: leads.unmatchedNames,
      droppedExistingLeadIds: dropped,
      expectedLeadIds: leads.leadIds,
      expectedCoverSession: Boolean(entry.is_cover_session),
      expectedNotionTutorUserId: expectedTutorUserId,
    });
    const notionError = differences.length ? "Notion read-back did not match what was saved." : null;
    await markNotion(
      admin,
      entryId,
      pageId,
      differences.length ? "error" : "synced",
      notionError
    );
    return { readback, differences, notionError, confirmed: differences.length === 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notion sync failed.";
    await markNotion(admin, entryId, pending ? null : pageId, "error", message);
    return { readback: null, differences: [], notionError: message, confirmed: false };
  }
}

function lessonTokenFromTitle(title: string): string {
  const match = title.match(/\b(?:Week|Lesson) \d+\b/);
  return match?.[0] ?? title;
}

async function packagePageId(
  admin: SupabaseClient,
  cohortId: string | null,
  packageInstanceId: string | null
): Promise<string | null> {
  if (cohortId) {
    const { data } = await admin.from("cohorts").select("notion_page_id").eq("id", cohortId).maybeSingle();
    return (data?.notion_page_id as string | null)?.trim() || null;
  }
  if (packageInstanceId) {
    const { data } = await admin
      .from("package_instances")
      .select("notion_page_id")
      .eq("id", packageInstanceId)
      .maybeSingle();
    return (data?.notion_page_id as string | null)?.trim() || null;
  }
  return null;
}

async function markNotion(
  admin: SupabaseClient,
  entryId: string,
  pageId: string | null,
  status: "synced" | "error",
  error: string | null
) {
  await admin
    .from("cohort_lesson_log_entries")
    .update({
      ...(pageId ? { notion_page_id: pageId } : {}),
      notion_sync_status: status,
      notion_sync_error: error,
      notion_synced_at: status === "synced" ? new Date().toISOString() : null,
    })
    .eq("id", entryId);
}

export async function logTutorLessonSweep(
  userClient: SupabaseClient,
  userId: string,
  input: LogLessonSweepInput
): Promise<LogLessonSweepResult> {
  const lessonDate = dateOnly(input.lessonDate);
  if (!lessonDate) return emptyResult("Choose the date you taught.");
  const recordingUrl = input.recordingUrl.trim();
  if (recordingUrl && !isHttpUrl(recordingUrl)) {
    return emptyResult("Enter a full recording link starting with http:// or https://");
  }
  if (input.attendance.length === 0) {
    return emptyResult("Add who attended before saving.");
  }

  const { client: admin, error: adminError } = tryCreateServiceRoleClient();
  if (!admin) return emptyResult(adminError ?? "The lesson could not be saved.");

  const loaded = await loadTarget(admin, userClient, userId, input);
  if (!loaded.ok) return emptyResult(loaded.error);

  const cover = await resolveCoverLessonWrite(admin, {
    ...input,
    assignedTutorId: loaded.target.assignedTutorId,
  });
  if (!cover.ok) return emptyResult(cover.error);

  const slot = lessonSlotLabel(loaded.target.courseName, loaded.target.lessonNumber);
  const title = formatLogNotionTitle({
    name: loaded.target.targetName,
    courseName: loaded.target.courseName,
    lessonNumber: loaded.target.lessonNumber,
    lessonDate,
  });
  if (!logTitleMatchesLessonNumber(title, loaded.target.lessonNumber)) {
    return emptyResult("The lesson title does not match the selected lesson.");
  }
  const pendingId = `pending-${crypto.randomUUID()}`;
  const marks = attendancePayload(input);

  const { data: entryId, error: rpcError } = await admin.rpc("apply_tutor_lesson_log", {
    p_cohort_id: loaded.target.cohortId,
    p_package_instance_id: loaded.target.packageInstanceId,
    p_lesson_id: input.lessonId,
    p_lesson_title: title,
    p_lesson_date: lessonDate,
    p_recording_url: recordingUrl || null,
    p_notes: input.notes.trim() || null,
    p_logged_by: userId,
    p_notion_page_id: pendingId,
    p_notion_tutor_user_id: cover.notionTutorUserId,
    p_attendance: marks.map((mark) => ({
      studentId: mark.studentId,
      kidProfileId: mark.kidProfileId,
      attended: mark.attended,
    })),
    p_recording_student_id: loaded.target.recordingStudentId,
  });

  if (rpcError || !entryId) {
    const message = rpcError?.message ?? "The lesson could not be saved.";
    return emptyResult(message.replace(/^.*ERROR:\s*/, "").slice(0, 240));
  }

  const { error: coverError } = await admin
    .from("cohort_lesson_log_entries")
    .update({
      is_cover_session: cover.isCoverSession,
      actual_tutor_id: cover.actualTutorId,
      actual_tutor_notion_user_id: cover.notionTutorUserId,
    })
    .eq("id", entryId);
  if (coverError) return emptyResult(coverError.message);

  const notion = await pushNotionForEntry(admin, entryId as string);
  const unlockedCount = input.attendance.length;
  const headline = isFoundationalCourse(loaded.target.courseName)
    ? `${slot} logged · ${loaded.target.targetName} · ${slot} unlocked`
    : `${slot} logged · ${loaded.target.targetName} · ${slot} unlocked for ${unlockedCount} students`;

  return {
    ok: true,
    entryId: entryId as string,
    headline,
    slotLabel: slot,
    targetName: loaded.target.targetName,
    unlockedCount,
    readback: notion.readback,
    differences: notion.differences,
    confirmed: notion.confirmed,
    readAt: londonTimeLabel(),
    notionError: notion.notionError,
  };
}

export async function retryTutorLessonNotion(
  userClient: SupabaseClient,
  userId: string,
  entryId: string
): Promise<LogLessonSweepResult> {
  const { client: admin, error: adminError } = tryCreateServiceRoleClient();
  if (!admin) return emptyResult(adminError ?? "Retry failed.");

  const { data: entry } = await admin
    .from("cohort_lesson_log_entries")
    .select("id, cohort_id, package_instance_id, lesson_id, lesson_title, logged_by")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry || entry.logged_by !== userId) {
    return emptyResult("That lesson log could not be retried.");
  }
  if (entry.cohort_id) {
    const allowed = await canManageCohort(userClient, userId, entry.cohort_id as string);
    if (!allowed) return emptyResult("You are not the tutor for this cohort.");
  } else if (entry.package_instance_id) {
    const { data: instance } = await admin
      .from("package_instances")
      .select("tutor_id")
      .eq("id", entry.package_instance_id)
      .maybeSingle();
    if (instance?.tutor_id !== userId) return emptyResult("You are not the tutor for this student.");
  }

  const notion = await pushNotionForEntry(admin, entryId);
  return {
    ok: true,
    entryId,
    headline: (entry.lesson_title as string) || "Lesson logged",
    slotLabel: lessonTokenFromTitle((entry.lesson_title as string) || ""),
    targetName: "",
    unlockedCount: 0,
    readback: notion.readback,
    differences: notion.differences,
    confirmed: notion.confirmed,
    readAt: londonTimeLabel(),
    notionError: notion.notionError,
  };
}

export async function retryPendingTutorLessonLogs(admin: SupabaseClient): Promise<{
  retried: number;
  synced: number;
  errors: string[];
}> {
  const { data: rows } = await admin
    .from("cohort_lesson_log_entries")
    .select("id, notion_sync_error")
    .eq("source", "app")
    .in("notion_sync_status", ["pending", "error"])
    .like("lesson_title", "%(app)")
    .limit(8);

  let synced = 0;
  const errors: string[] = [];
  for (const row of rows ?? []) {
    const result = await pushNotionForEntry(admin, row.id as string);
    if (result.confirmed) synced += 1;
    else if (result.notionError) errors.push(result.notionError);
  }
  return { retried: rows?.length ?? 0, synced, errors };
}
