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
  // Assigned tutors can always read their course_enrollments (tutor_id = auth.uid()).
  // cohort_members SELECT often goes through is_tutor()/current_app_role(), which can
  // be false when staff roles live only in profile_roles — so enrollments are the
  // reliable roster source; members supplement left_at when visible.
  const [
    { data: memberRows },
    { data: enrollmentRows, error: enrollmentError },
    { data: attendanceRows, error: attendanceError },
  ] = await Promise.all([
    supabase
      .from("cohort_members")
      .select("user_id, kid_profile_id, left_at")
      .eq("cohort_id", cohortId),
    supabase
      .from("course_enrollments")
      .select("user_id, kid_profile_id")
      .eq("cohort_id", cohortId)
      .eq("delivery_mode", "group"),
    supabase
      .from("cohort_lesson_attendance")
      .select("student_id, kid_profile_id, attended, marked_at, tutor_note")
      .eq("cohort_id", cohortId)
      .eq("lesson_id", lessonId),
  ]);

  if (enrollmentError) throw enrollmentError;

  if (attendanceError) {
    if (isMissingAttendanceSchema(attendanceError.message)) return [];
    throw attendanceError;
  }

  const activeUserIds = new Set<string>();
  const activeKidIds = new Set<string>();
  for (const row of enrollmentRows ?? []) {
    if (row.user_id) activeUserIds.add(row.user_id as string);
    if (row.kid_profile_id) activeKidIds.add(row.kid_profile_id as string);
  }

  const membersVisible = (memberRows ?? []).length > 0;
  if (membersVisible) {
    for (const row of memberRows ?? []) {
      if (row.user_id) {
        if (row.left_at == null) activeUserIds.add(row.user_id as string);
        else activeUserIds.delete(row.user_id as string);
      }
      if (row.kid_profile_id) {
        if (row.left_at == null) activeKidIds.add(row.kid_profile_id as string);
        else activeKidIds.delete(row.kid_profile_id as string);
      }
    }
  }

  const attendanceByActor = new Map<
    string,
    { attended: boolean; markedAt: string; tutorNote: string | null }
  >();
  for (const row of attendanceRows ?? []) {
    const key = (row.kid_profile_id as string | null) ?? (row.student_id as string | null);
    if (!key) continue;
    attendanceByActor.set(key, {
      attended: row.attended as boolean,
      markedAt: row.marked_at as string,
      tutorNote: (row.tutor_note as string | null) ?? null,
    });
  }

  const rosterUserIds = new Set<string>([...activeUserIds]);
  const rosterKidIds = new Set<string>([...activeKidIds]);
  for (const row of attendanceRows ?? []) {
    if (row.student_id) rosterUserIds.add(row.student_id as string);
    if (row.kid_profile_id) rosterKidIds.add(row.kid_profile_id as string);
  }

  if (rosterUserIds.size === 0 && rosterKidIds.size === 0) return [];

  const [{ data: profiles }, { data: kids }] = await Promise.all([
    rosterUserIds.size
      ? supabase
          .from("profiles")
          .select("id, full_name, preferred_name")
          .in("id", [...rosterUserIds])
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; preferred_name: string | null }> }),
    rosterKidIds.size
      ? supabase.from("kid_profiles").select("id, name").in("id", [...rosterKidIds])
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ]);

  const nameById = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      getDisplayName(profile) ?? "Student",
    ] as const)
  );
  for (const kid of kids ?? []) {
    nameById.set(kid.id, kid.name || "Student");
  }

  const roster: CohortAttendanceRosterStudent[] = [];
  for (const studentId of rosterUserIds) {
    const existing = attendanceByActor.get(studentId);
    roster.push({
      studentId,
      studentName: nameById.get(studentId) ?? "Student",
      isActiveMember: activeUserIds.has(studentId),
      attended: existing?.attended ?? null,
      markedAt: existing?.markedAt ?? null,
    });
  }
  for (const kidId of rosterKidIds) {
    const existing = attendanceByActor.get(kidId);
    roster.push({
      studentId: kidId,
      studentName: nameById.get(kidId) ?? "Student",
      isActiveMember: activeKidIds.has(kidId),
      attended: existing?.attended ?? null,
      markedAt: existing?.markedAt ?? null,
    });
  }

  return roster.sort((a, b) => a.studentName.localeCompare(b.studentName));
}

export async function kidProfileIdsInCohort(
  supabase: SupabaseClient,
  cohortId: string
): Promise<Set<string>> {
  const [{ data: kidMembers }, { data: kidEnrollments }] = await Promise.all([
    supabase
      .from("cohort_members")
      .select("kid_profile_id")
      .eq("cohort_id", cohortId)
      .not("kid_profile_id", "is", null),
    supabase
      .from("course_enrollments")
      .select("kid_profile_id")
      .eq("cohort_id", cohortId)
      .not("kid_profile_id", "is", null),
  ]);
  return new Set(
    [...(kidMembers ?? []), ...(kidEnrollments ?? [])]
      .map((row) => row.kid_profile_id as string | null)
      .filter((id): id is string => Boolean(id))
  );
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
