import { getDisplayName } from "@/lib/profile/display-name";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CohortAttendanceLessonOption = {
  id: string;
  lessonNumber: number;
  title: string;
};

export type CohortAttendanceRosterStudent = {
  studentId: string;
  studentName: string;
  isActiveMember: boolean;
  attended: boolean | null;
  markedAt: string | null;
};

function isMissingAttendanceSchema(message: string): boolean {
  return message.toLowerCase().includes("cohort_lesson_attendance");
}

export async function loadCohortAttendanceLessons(
  supabase: SupabaseClient,
  cohortId: string,
  courseId: string
): Promise<CohortAttendanceLessonOption[]> {
  const { data, error } = await supabase
    .from("lessons")
    .select("id, lesson_number, title")
    .eq("course_id", courseId)
    .order("lesson_number");

  if (error) {
    if (isMissingAttendanceSchema(error.message)) return [];
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    lessonNumber: row.lesson_number,
    title: row.title,
  }));
}

export async function loadCohortAttendanceRoster(
  supabase: SupabaseClient,
  cohortId: string,
  lessonId: string
): Promise<CohortAttendanceRosterStudent[]> {
  const [{ data: activeMembers }, { data: attendanceRows, error: attendanceError }] =
    await Promise.all([
    supabase
      .from("cohort_members")
      .select("user_id")
      .eq("cohort_id", cohortId)
      .is("left_at", null),
    supabase
      .from("cohort_lesson_attendance")
      .select("student_id, attended, marked_at")
      .eq("cohort_id", cohortId)
      .eq("lesson_id", lessonId),
  ]);

  if (attendanceError) {
    if (isMissingAttendanceSchema(attendanceError.message)) return [];
    throw attendanceError;
  }

  const activeIds = new Set((activeMembers ?? []).map((row) => row.user_id as string));
  const attendanceByStudent = new Map(
    (attendanceRows ?? []).map((row) => [
      row.student_id as string,
      {
        attended: row.attended as boolean,
        markedAt: row.marked_at as string,
      },
    ])
  );

  const rosterIds = new Set<string>([...activeIds]);
  for (const studentId of attendanceByStudent.keys()) {
    rosterIds.add(studentId);
  }

  if (rosterIds.size === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, preferred_name")
    .in("id", [...rosterIds]);

  const nameById = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      getDisplayName(profile) ?? "Student",
    ] as const)
  );

  return [...rosterIds]
    .map((studentId) => {
      const existing = attendanceByStudent.get(studentId);
      return {
        studentId,
        studentName: nameById.get(studentId) ?? "Student",
        isActiveMember: activeIds.has(studentId),
        attended: existing?.attended ?? null,
        markedAt: existing?.markedAt ?? null,
      };
    })
    .sort((a, b) => a.studentName.localeCompare(b.studentName));
}

export async function loadLessonsWithAttendanceMarked(
  supabase: SupabaseClient,
  cohortId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("cohort_lesson_attendance")
    .select("lesson_id")
    .eq("cohort_id", cohortId);

  if (error) {
    if (isMissingAttendanceSchema(error.message)) return new Set();
    throw error;
  }

  return new Set((data ?? []).map((row) => row.lesson_id as string));
}
