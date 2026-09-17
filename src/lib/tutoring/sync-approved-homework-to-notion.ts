import "server-only";

import { isCountableLessonLogStatus } from "@/lib/lessons/lesson-log-progress";
import {
  matchStudentsToNotionLeads,
  pushLessonLogAttendanceHomeworkToNotion,
  readLessonLogAttendanceHomeworkFromNotion,
} from "@/lib/notion/lesson-log-attendance-sync";
import type { SupabaseClient } from "@supabase/supabase-js";

function uniqueIds(ids: Array<string | null | undefined>): string[] {
  return [...new Set(ids.map((id) => id?.trim()).filter((id): id is string => Boolean(id)))];
}

async function resolveHomeworkCohortId(
  supabase: SupabaseClient,
  options: { studentId: string | null; kidProfileId: string | null; lessonId: string }
): Promise<string | null> {
  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("course_id")
    .eq("id", options.lessonId)
    .maybeSingle();
  if (lessonError) throw lessonError;
  const courseId = (lesson?.course_id as string | null)?.trim() ?? "";
  if (!courseId) return null;

  let enrollmentQuery = supabase
    .from("course_enrollments")
    .select("cohort_id")
    .eq("course_id", courseId)
    .not("cohort_id", "is", null);
  enrollmentQuery = options.kidProfileId
    ? enrollmentQuery.eq("kid_profile_id", options.kidProfileId)
    : enrollmentQuery.eq("user_id", options.studentId ?? "");

  const { data: enrollments, error: enrollmentError } = await enrollmentQuery;
  if (enrollmentError) throw enrollmentError;
  const enrollmentIds = uniqueIds((enrollments ?? []).map((row) => row.cohort_id as string | null));
  if (enrollmentIds.length === 1) return enrollmentIds[0]!;
  if (enrollmentIds.length > 1) return null;

  let memberQuery = supabase
    .from("cohort_members")
    .select("cohort_id, cohorts!inner(course_id)")
    .eq("cohorts.course_id", courseId)
    .is("left_at", null);
  memberQuery = options.kidProfileId
    ? memberQuery.eq("kid_profile_id", options.kidProfileId)
    : memberQuery.eq("user_id", options.studentId ?? "");

  const { data: members, error: memberError } = await memberQuery;
  if (memberError) throw memberError;
  const memberIds = uniqueIds((members ?? []).map((row) => row.cohort_id as string | null));
  return memberIds.length === 1 ? memberIds[0]! : null;
}

async function findLessonLogNotionPageId(
  supabase: SupabaseClient,
  cohortId: string,
  lessonId: string
): Promise<string | null> {
  const { data: lesson } = await supabase
    .from("lessons")
    .select("lesson_number")
    .eq("id", lessonId)
    .maybeSingle();
  const lessonNumber = Number(lesson?.lesson_number) || 0;

  const { data: logRows } = await supabase
    .from("cohort_lesson_log_entries")
    .select("id, notion_page_id, status, lesson_date, lesson_id")
    .eq("cohort_id", cohortId)
    .order("lesson_date", { ascending: true })
    .order("id", { ascending: true });

  const countable = (logRows ?? []).filter((row) =>
    isCountableLessonLogStatus(row.status as string | null)
  );
  const matchedByLessonId = countable.find((row) => row.lesson_id === lessonId);
  const matched =
    matchedByLessonId ?? (lessonNumber > 0 ? (countable[lessonNumber - 1] ?? null) : null);
  return matched?.notion_page_id?.trim() || null;
}

/**
 * Tutor attendance already PATCHes Notion Attendees in-request.
 * Approving homework did not — this mirrors that immediate Homework write.
 */
export async function syncApprovedHomeworkToNotion(
  supabase: SupabaseClient,
  options: {
    studentId: string | null;
    kidProfileId: string | null;
    lessonId: string;
    markedBy: string;
  }
): Promise<{ notionNote: string }> {
  const actorId = options.kidProfileId ?? options.studentId;
  if (!actorId) {
    return { notionNote: " Notion Homework skipped: submission has no student." };
  }

  const cohortId = await resolveHomeworkCohortId(supabase, {
    studentId: options.studentId,
    kidProfileId: options.kidProfileId,
    lessonId: options.lessonId,
  });
  if (!cohortId) {
    return { notionNote: " Notion Homework skipped: could not uniquely resolve the cohort." };
  }

  const now = new Date().toISOString();
  const { error: homeworkError } = options.kidProfileId
    ? await supabase.from("cohort_lesson_homework").upsert(
        {
          cohort_id: cohortId,
          lesson_id: options.lessonId,
          student_id: null,
          kid_profile_id: options.kidProfileId,
          completed: true,
          marked_by: options.markedBy,
          marked_at: now,
          updated_at: now,
        },
        { onConflict: "cohort_id,lesson_id,kid_profile_id" }
      )
    : await supabase.from("cohort_lesson_homework").upsert(
        {
          cohort_id: cohortId,
          lesson_id: options.lessonId,
          student_id: options.studentId,
          kid_profile_id: null,
          completed: true,
          marked_by: options.markedBy,
          marked_at: now,
          updated_at: now,
        },
        { onConflict: "cohort_id,lesson_id,student_id" }
      );
  if (homeworkError && !homeworkError.message.toLowerCase().includes("cohort_lesson_homework")) {
    return { notionNote: ` App homework mark failed: ${homeworkError.message}.` };
  }

  const notionPageId = await findLessonLogNotionPageId(supabase, cohortId, options.lessonId);
  if (!notionPageId) {
    return { notionNote: " Notion Homework skipped: no matching Lessons Log page yet." };
  }

  const [{ data: profiles }, { data: kids }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, preferred_name").eq("id", actorId).maybeSingle(),
    supabase.from("kid_profiles").select("id, name").eq("id", actorId).maybeSingle(),
  ]);
  const studentName =
    (kids?.name as string | null)?.trim() ||
    (profiles?.preferred_name as string | null)?.trim() ||
    (profiles?.full_name as string | null)?.trim() ||
    "Student";

  const [leadMatch] = await matchStudentsToNotionLeads(supabase, [
    { studentId: actorId, studentName },
  ]);
  if (!leadMatch?.ok) {
    return {
      notionNote: ` Warning: no Notion Lead App User ID for ${studentName}.`,
    };
  }

  const existing = await readLessonLogAttendanceHomeworkFromNotion(notionPageId);
  await pushLessonLogAttendanceHomeworkToNotion({
    notionPageId,
    attendeeLeadPageIds: existing.attendeeLeadIds,
    homeworkLeadPageIds: [...existing.homeworkLeadIds, leadMatch.leadPageId],
    updateAttendees: false,
    updateHomework: true,
  });

  return { notionNote: " Notion Homework updated." };
}
