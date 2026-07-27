import "server-only";

import { resolveCurriculumLessonForLogEntry } from "@/lib/lessons/lesson-log-roster";
import {
  matchStudentsToNotionLeads,
  pushLessonLogAttendanceHomeworkToNotion,
} from "@/lib/notion/lesson-log-attendance-sync";
import type { SupabaseClient } from "@supabase/supabase-js";

export type LessonLogStudentMark = {
  studentId: string;
  attended: boolean;
  homeworkCompleted: boolean;
};

export type SaveLessonLogAttendanceHomeworkResult =
  | {
      ok: true;
      savedAttendance: number;
      savedHomework: number;
      notionPushed: boolean;
      homeworkTableMissing: boolean;
      unmatchedPresent: Array<{ studentId: string; studentName: string }>;
      unmatchedHomework: Array<{ studentId: string; studentName: string }>;
      curriculumLessonTitle: string | null;
    }
  | { ok: false; error: string };

/**
 * Persist attendance + homework in Supabase and push Attendees/Homework
 * relations to the linked Notion Lessons Log page (payroll exception).
 */
export async function saveLessonLogAttendanceHomework(
  supabase: SupabaseClient,
  options: {
    lessonLogEntryId: string;
    marks: LessonLogStudentMark[];
    markedBy: string;
  }
): Promise<SaveLessonLogAttendanceHomeworkResult> {
  if (options.marks.length === 0) {
    return { ok: false, error: "Mark at least one student before saving." };
  }

  const { data: entry, error: entryError } = await supabase
    .from("cohort_lesson_log_entries")
    .select("id, cohort_id, notion_page_id, status")
    .eq("id", options.lessonLogEntryId)
    .maybeSingle();

  if (entryError) return { ok: false, error: entryError.message };
  if (!entry) return { ok: false, error: "Lesson log entry not found." };
  if (!entry.cohort_id) {
    return {
      ok: false,
      error: "Attendance/homework is only available for cohort lesson logs.",
    };
  }

  const curriculum = await resolveCurriculumLessonForLogEntry(
    supabase,
    entry.cohort_id,
    entry.id
  );
  if (!curriculum) {
    return {
      ok: false,
      error:
        "Could not map this log entry to a curriculum lesson (Cancelled entries are excluded from the sequence). Use a non-cancelled lesson log.",
    };
  }

  const now = new Date().toISOString();
  const attendanceRows = options.marks.map((mark) => ({
    cohort_id: entry.cohort_id,
    lesson_id: curriculum.lessonId,
    student_id: mark.studentId,
    attended: mark.attended,
    marked_by: options.markedBy,
    marked_at: now,
    updated_at: now,
  }));
  const homeworkRows = options.marks.map((mark) => ({
    cohort_id: entry.cohort_id,
    lesson_id: curriculum.lessonId,
    student_id: mark.studentId,
    completed: mark.homeworkCompleted,
    marked_by: options.markedBy,
    marked_at: now,
    updated_at: now,
  }));

  const { error: attendanceError } = await supabase
    .from("cohort_lesson_attendance")
    .upsert(attendanceRows, { onConflict: "cohort_id,lesson_id,student_id" });
  if (attendanceError) {
    return { ok: false, error: attendanceError.message };
  }

  let homeworkTableMissing = false;
  const { error: homeworkError } = await supabase
    .from("cohort_lesson_homework")
    .upsert(homeworkRows, { onConflict: "cohort_id,lesson_id,student_id" });
  if (homeworkError) {
    if (homeworkError.message.toLowerCase().includes("cohort_lesson_homework")) {
      // Pre-migration: still push Notion Homework; app table comes later.
      homeworkTableMissing = true;
    } else {
      return { ok: false, error: homeworkError.message };
    }
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, preferred_name")
    .in(
      "id",
      options.marks.map((m) => m.studentId)
    );

  const nameById = new Map(
    (profiles ?? []).map((profile) => {
      const name =
        (profile.preferred_name as string | null)?.trim() ||
        (profile.full_name as string | null)?.trim() ||
        "Student";
      return [profile.id as string, name] as const;
    })
  );

  const matches = await matchStudentsToNotionLeads(
    supabase,
    options.marks.map((mark) => ({
      studentId: mark.studentId,
      studentName: nameById.get(mark.studentId) ?? "Student",
    }))
  );
  const matchById = new Map(matches.map((m) => [m.studentId, m]));

  const unmatchedPresent: Array<{ studentId: string; studentName: string }> = [];
  const unmatchedHomework: Array<{ studentId: string; studentName: string }> = [];
  const attendeeLeadPageIds: string[] = [];
  const homeworkLeadPageIds: string[] = [];

  for (const mark of options.marks) {
    const match = matchById.get(mark.studentId);
    if (mark.attended) {
      if (match?.ok) {
        attendeeLeadPageIds.push(match.leadPageId);
      } else {
        unmatchedPresent.push({
          studentId: mark.studentId,
          studentName: nameById.get(mark.studentId) ?? "Student",
        });
      }
    }
    if (mark.homeworkCompleted) {
      if (match?.ok) {
        homeworkLeadPageIds.push(match.leadPageId);
      } else {
        unmatchedHomework.push({
          studentId: mark.studentId,
          studentName: nameById.get(mark.studentId) ?? "Student",
        });
      }
    }
  }

  let notionPushed = false;
  if (entry.notion_page_id) {
    try {
      await pushLessonLogAttendanceHomeworkToNotion({
        notionPageId: entry.notion_page_id,
        attendeeLeadPageIds,
        homeworkLeadPageIds,
        updateAttendees: true,
        updateHomework: true,
      });
      notionPushed = true;
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? `Saved in app, but Notion sync failed: ${error.message}`
            : "Saved in app, but Notion sync failed.",
      };
    }
  }

  return {
    ok: true,
    savedAttendance: options.marks.length,
    savedHomework: homeworkTableMissing ? 0 : options.marks.length,
    notionPushed,
    homeworkTableMissing,
    unmatchedPresent,
    unmatchedHomework,
    curriculumLessonTitle: curriculum.title,
  };
}
