import { getDisplayName } from "@/lib/profile/display-name";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import {
  resolveCohortRosterActors,
  type CohortRosterSourceRow,
} from "@/lib/tutoring/cohort-attendance-roster";
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

function asRosterRow(row: {
  user_id?: string | null;
  kid_profile_id?: string | null;
  student_id?: string | null;
  left_at?: string | null;
}): CohortRosterSourceRow {
  return {
    userId: (row.user_id as string | null | undefined) ?? (row.student_id as string | null | undefined) ?? null,
    kidProfileId: (row.kid_profile_id as string | null | undefined) ?? null,
    leftAt: (row.left_at as string | null | undefined) ?? null,
  };
}

export async function cohortIsKidsCourse(
  supabase: SupabaseClient,
  cohortId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("cohorts")
    .select("courses(content_track)")
    .eq("id", cohortId)
    .maybeSingle();
  const course = Array.isArray(data?.courses) ? data.courses[0] : data?.courses;
  return (course as { content_track?: string | null } | null)?.content_track === "kids";
}

async function rosterQueryClient(userClient: SupabaseClient): Promise<SupabaseClient> {
  return tryCreateServiceRoleClient().client ?? userClient;
}

export async function loadKidsByParentUserId(
  supabase: SupabaseClient,
  parentUserIds: string[]
): Promise<Map<string, string[]>> {
  const kidsByParentUserId = new Map<string, string[]>();
  if (parentUserIds.length === 0) return kidsByParentUserId;

  const db = await rosterQueryClient(supabase);
  const { data } = await db
    .from("kid_profiles")
    .select("id, parent_user_id")
    .in("parent_user_id", parentUserIds);

  for (const row of data ?? []) {
    const parentId = row.parent_user_id as string | null;
    const kidId = row.id as string | null;
    if (!parentId || !kidId) continue;
    const list = kidsByParentUserId.get(parentId) ?? [];
    list.push(kidId);
    kidsByParentUserId.set(parentId, list);
  }

  return kidsByParentUserId;
}

export async function loadKidProfileNames(
  supabase: SupabaseClient,
  kidIds: string[]
): Promise<Map<string, string>> {
  const nameById = new Map<string, string>();
  if (kidIds.length === 0) return nameById;

  const readNames = async (client: SupabaseClient) => {
    const { data } = await client.from("kid_profiles").select("id, name").in("id", kidIds);
    for (const kid of data ?? []) {
      const name = (kid.name as string | null)?.trim();
      if (kid.id && name) nameById.set(kid.id as string, name);
    }
  };

  await readNames(supabase);
  if (nameById.size < kidIds.length) {
    const db = await rosterQueryClient(supabase);
    if (db !== supabase) await readNames(db);
  }

  return nameById;
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
    isKidsCourse,
    { data: memberRows },
    { data: enrollmentRows, error: enrollmentError },
    { data: attendanceRows, error: attendanceError },
  ] = await Promise.all([
    cohortIsKidsCourse(supabase, cohortId),
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

  const parentUserIds = [
    ...new Set(
      [...(memberRows ?? []), ...(enrollmentRows ?? [])]
        .map((row) => row.user_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const kidsByParentUserId = await loadKidsByParentUserId(supabase, parentUserIds);
  const actors = resolveCohortRosterActors({
    isKidsCourse,
    members: (memberRows ?? []).map(asRosterRow),
    enrollments: (enrollmentRows ?? []).map(asRosterRow),
    extraActors: (attendanceRows ?? []).map(asRosterRow),
    kidsByParentUserId,
  });

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

  if (actors.rosterUserIds.size === 0 && actors.rosterKidIds.size === 0) return [];

  const [{ data: profiles }, kidNames] = await Promise.all([
    actors.rosterUserIds.size
      ? supabase
          .from("profiles")
          .select("id, full_name, preferred_name")
          .in("id", [...actors.rosterUserIds])
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; preferred_name: string | null }> }),
    loadKidProfileNames(supabase, [...actors.rosterKidIds]),
  ]);

  const nameById = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      getDisplayName(profile) ?? "Student",
    ] as const)
  );
  for (const [kidId, name] of kidNames) {
    nameById.set(kidId, name);
  }

  const roster: CohortAttendanceRosterStudent[] = [];
  for (const studentId of actors.rosterUserIds) {
    const existing = attendanceByActor.get(studentId);
    roster.push({
      studentId,
      studentName: nameById.get(studentId) ?? "Student",
      isActiveMember: actors.activeUserIds.has(studentId),
      attended: existing?.attended ?? null,
      markedAt: existing?.markedAt ?? null,
    });
  }
  for (const kidId of actors.rosterKidIds) {
    const existing = attendanceByActor.get(kidId);
    roster.push({
      studentId: kidId,
      studentName: nameById.get(kidId) ?? "Student",
      isActiveMember: actors.activeKidIds.has(kidId),
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
  const [{ data: kidMembers }, { data: kidEnrollments }, { data: parentMembers }, { data: parentEnrollments }] =
    await Promise.all([
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
      supabase
        .from("cohort_members")
        .select("user_id")
        .eq("cohort_id", cohortId)
        .is("left_at", null)
        .not("user_id", "is", null),
      supabase
        .from("course_enrollments")
        .select("user_id")
        .eq("cohort_id", cohortId)
        .not("user_id", "is", null),
    ]);

  const ids = new Set(
    [...(kidMembers ?? []), ...(kidEnrollments ?? [])]
      .map((row) => row.kid_profile_id as string | null)
      .filter((id): id is string => Boolean(id))
  );

  if (!(await cohortIsKidsCourse(supabase, cohortId))) return ids;

  const parentUserIds = [
    ...new Set(
      [...(parentMembers ?? []), ...(parentEnrollments ?? [])]
        .map((row) => row.user_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const kidsByParentUserId = await loadKidsByParentUserId(supabase, parentUserIds);
  for (const kidIds of kidsByParentUserId.values()) {
    for (const kidId of kidIds) ids.add(kidId);
  }
  return ids;
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
