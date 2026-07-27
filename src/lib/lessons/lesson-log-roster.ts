import "server-only";

import { getDisplayName } from "@/lib/profile/display-name";
import {
  resolveCurriculumLessonForCohortLogEntry,
} from "@/lib/lessons/lesson-log-lesson-link";
import { matchStudentsToNotionLeads } from "@/lib/notion/lesson-log-attendance-sync";
import type { SupabaseClient } from "@supabase/supabase-js";

export type LessonLogRosterStudent = {
  studentId: string;
  studentName: string;
  isActiveMember: boolean;
  attended: boolean | null;
  homeworkCompleted: boolean | null;
  notionLeadPageId: string | null;
  notionLeadLinked: boolean;
};

export type LessonLogRosterContext = {
  cohortId: string;
  lessonLogEntryId: string;
  notionPageId: string | null;
  curriculumLessonId: string | null;
  curriculumLessonNumber: number | null;
  curriculumLessonTitle: string | null;
  students: LessonLogRosterStudent[];
  unlinkedStudents: Array<{ studentId: string; studentName: string }>;
};

function isMissingHomeworkSchema(message: string): boolean {
  return message.toLowerCase().includes("cohort_lesson_homework");
}

function isMissingAttendanceSchema(message: string): boolean {
  return message.toLowerCase().includes("cohort_lesson_attendance");
}

/**
 * Map a cohort lesson-log entry to a curriculum lessons.id.
 * Prefers stored lesson_id; falls back to sequential position derivation.
 */
export async function resolveCurriculumLessonForLogEntry(
  supabase: SupabaseClient,
  cohortId: string,
  lessonLogEntryId: string
): Promise<{
  lessonId: string;
  lessonNumber: number;
  title: string;
} | null> {
  const { data: entry, error: entryError } = await supabase
    .from("cohort_lesson_log_entries")
    .select("lesson_id, status")
    .eq("id", lessonLogEntryId)
    .maybeSingle();

  if (entryError) {
    if (entryError.message.toLowerCase().includes("lesson_id")) {
      return resolveCurriculumLessonForCohortLogEntry(supabase, cohortId, lessonLogEntryId);
    }
    throw entryError;
  }

  if (entry?.lesson_id) {
    const { data: lesson, error: lessonError } = await supabase
      .from("lessons")
      .select("id, lesson_number, title")
      .eq("id", entry.lesson_id)
      .maybeSingle();
    if (lessonError) throw lessonError;
    if (lesson) {
      return {
        lessonId: lesson.id,
        lessonNumber: lesson.lesson_number,
        title: lesson.title,
      };
    }
  }

  return resolveCurriculumLessonForCohortLogEntry(supabase, cohortId, lessonLogEntryId);
}

export async function loadLessonLogRosterContext(
  supabase: SupabaseClient,
  lessonLogEntryId: string
): Promise<LessonLogRosterContext | { error: string }> {
  const { data: entry, error: entryError } = await supabase
    .from("cohort_lesson_log_entries")
    .select("id, cohort_id, notion_page_id, status")
    .eq("id", lessonLogEntryId)
    .maybeSingle();

  if (entryError) return { error: entryError.message };
  if (!entry) return { error: "Lesson log entry not found." };
  if (!entry.cohort_id) {
    return { error: "Attendance/homework is only available for cohort lesson logs." };
  }

  const curriculum = await resolveCurriculumLessonForLogEntry(
    supabase,
    entry.cohort_id,
    entry.id
  );

  const [{ data: activeMembers }, attendanceResult, homeworkResult] = await Promise.all([
    supabase
      .from("cohort_members")
      .select("user_id")
      .eq("cohort_id", entry.cohort_id)
      .is("left_at", null),
    curriculum
      ? supabase
          .from("cohort_lesson_attendance")
          .select("student_id, attended")
          .eq("cohort_id", entry.cohort_id)
          .eq("lesson_id", curriculum.lessonId)
      : Promise.resolve({ data: [] as Array<{ student_id: string; attended: boolean }>, error: null }),
    curriculum
      ? supabase
          .from("cohort_lesson_homework")
          .select("student_id, completed")
          .eq("cohort_id", entry.cohort_id)
          .eq("lesson_id", curriculum.lessonId)
      : Promise.resolve({
          data: [] as Array<{ student_id: string; completed: boolean }>,
          error: null,
        }),
  ]);

  if (attendanceResult.error && !isMissingAttendanceSchema(attendanceResult.error.message)) {
    return { error: attendanceResult.error.message };
  }

  const homeworkTableMissing =
    Boolean(homeworkResult.error) &&
    isMissingHomeworkSchema(homeworkResult.error!.message);
  if (homeworkResult.error && !homeworkTableMissing) {
    return { error: homeworkResult.error.message };
  }

  const attendanceByStudent = new Map(
    (attendanceResult.data ?? []).map((row) => [
      row.student_id as string,
      row.attended as boolean,
    ])
  );
  const homeworkByStudent = new Map(
    (homeworkResult.data ?? []).map((row) => [
      row.student_id as string,
      row.completed as boolean,
    ])
  );

  // Until cohort_lesson_homework is migrated, seed homework marks from Notion.
  if (homeworkTableMissing && entry.notion_page_id) {
    try {
      const { readLessonLogAttendanceHomeworkFromNotion } = await import(
        "@/lib/notion/lesson-log-attendance-sync"
      );
      const { homeworkLeadIds } = await readLessonLogAttendanceHomeworkFromNotion(
        entry.notion_page_id
      );
      if (homeworkLeadIds.length > 0) {
        const { data: linkedProfiles } = await supabase
          .from("profiles")
          .select("id, notion_lead_page_id")
          .in("notion_lead_page_id", homeworkLeadIds);
        for (const profile of linkedProfiles ?? []) {
          if (profile.id) homeworkByStudent.set(profile.id, true);
        }
      }
    } catch {
      // Notion read is best-effort for the pre-migration fallback.
    }
  }

  const activeIds = new Set((activeMembers ?? []).map((row) => row.user_id as string));
  const rosterIds = new Set<string>([...activeIds]);
  for (const id of attendanceByStudent.keys()) rosterIds.add(id);
  for (const id of homeworkByStudent.keys()) rosterIds.add(id);

  if (rosterIds.size === 0) {
    return {
      cohortId: entry.cohort_id,
      lessonLogEntryId: entry.id,
      notionPageId: entry.notion_page_id,
      curriculumLessonId: curriculum?.lessonId ?? null,
      curriculumLessonNumber: curriculum?.lessonNumber ?? null,
      curriculumLessonTitle: curriculum?.title ?? null,
      students: [],
      unlinkedStudents: [],
    };
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, preferred_name, notion_lead_page_id")
    .in("id", [...rosterIds]);

  const baseStudents = [...rosterIds]
    .map((studentId) => {
      const profile = (profiles ?? []).find((row) => row.id === studentId);
      return {
        studentId,
        studentName: getDisplayName(profile) ?? "Student",
        isActiveMember: activeIds.has(studentId),
        attended: attendanceByStudent.has(studentId)
          ? (attendanceByStudent.get(studentId) as boolean)
          : null,
        homeworkCompleted: homeworkByStudent.has(studentId)
          ? (homeworkByStudent.get(studentId) as boolean)
          : null,
        notionLeadPageId: profile?.notion_lead_page_id ?? null,
      };
    })
    .sort((a, b) => a.studentName.localeCompare(b.studentName));

  const matches = await matchStudentsToNotionLeads(
    supabase,
    baseStudents.map((s) => ({ studentId: s.studentId, studentName: s.studentName }))
  );
  const matchById = new Map(matches.map((m) => [m.studentId, m]));

  const students: LessonLogRosterStudent[] = baseStudents.map((student) => {
    const match = matchById.get(student.studentId);
    return {
      ...student,
      notionLeadPageId:
        match?.ok === true ? match.leadPageId : student.notionLeadPageId,
      notionLeadLinked: match?.ok === true,
    };
  });

  return {
    cohortId: entry.cohort_id,
    lessonLogEntryId: entry.id,
    notionPageId: entry.notion_page_id,
    curriculumLessonId: curriculum?.lessonId ?? null,
    curriculumLessonNumber: curriculum?.lessonNumber ?? null,
    curriculumLessonTitle: curriculum?.title ?? null,
    students,
    unlinkedStudents: students
      .filter((s) => !s.notionLeadLinked)
      .map((s) => ({ studentId: s.studentId, studentName: s.studentName })),
  };
}
