import type { SupabaseClient } from "@supabase/supabase-js";
import { loadEmailsByUserId } from "@/lib/admin/load-admin-profiles-with-email";
import { getStaffFacingName, resolveStudentLabel } from "@/lib/profile/display-name";
import type {
  TutorCohortMatchCandidate,
  TutorStudentMatchCandidate,
} from "@/lib/calendar/match-events";

async function loadEmailsForUserIds(
  adminClient: SupabaseClient,
  userIds: string[]
): Promise<Map<string, string>> {
  const emailByUserId = new Map<string, string>();
  const rows = await loadEmailsByUserId(adminClient, userIds);
  for (const [userId, email] of rows) {
    if (email) emailByUserId.set(userId, email.toLowerCase());
  }
  return emailByUserId;
}

export async function loadTutorMatchCandidates(
  adminClient: SupabaseClient,
  tutorId: string
): Promise<{ students: TutorStudentMatchCandidate[]; cohorts: TutorCohortMatchCandidate[] }> {
  const { data: enrollments, error } = await adminClient
    .from("course_enrollments")
    .select("user_id, course_id, cohort_id, delivery_mode")
    .eq("tutor_id", tutorId);

  if (error) throw error;

  const studentIds = [...new Set((enrollments ?? []).map((row) => row.user_id))];
  const cohortIds = [
    ...new Set(
      (enrollments ?? [])
        .map((row) => row.cohort_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const [{ data: assignedCohorts }, { data: profiles }, { data: cohortRows }, { data: members }] =
    await Promise.all([
      adminClient.from("cohorts").select("id, name, course_id").eq("tutor_id", tutorId),
      studentIds.length > 0
        ? adminClient
            .from("profiles")
            .select("id, full_name, preferred_name")
            .in("id", studentIds)
        : Promise.resolve({
            data: [] as { id: string; full_name: string | null; preferred_name: string | null }[],
          }),
      cohortIds.length > 0
        ? adminClient.from("cohorts").select("id, name, course_id").in("id", cohortIds)
        : Promise.resolve({ data: [] as { id: string; name: string; course_id: string }[] }),
      cohortIds.length > 0
        ? adminClient
            .from("cohort_members")
            .select("cohort_id, user_id")
            .in("cohort_id", cohortIds)
            .is("left_at", null)
        : Promise.resolve({ data: [] as { cohort_id: string; user_id: string }[] }),
    ]);

  const allCohortRows = [
    ...(cohortRows ?? []),
    ...(assignedCohorts ?? []).filter(
      (cohort) => !(cohortRows ?? []).some((row) => row.id === cohort.id)
    ),
  ];

  const memberUserIds = (members ?? []).map((member) => member.user_id);
  const emailByUserId = await loadEmailsForUserIds(adminClient, [...studentIds, ...memberUserIds]);

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  const students: TutorStudentMatchCandidate[] = (enrollments ?? []).map((enrollment) => {
    const profile = profileById.get(enrollment.user_id);
    const email = emailByUserId.get(enrollment.user_id) ?? "";
    return {
      studentId: enrollment.user_id,
      email,
      displayName: resolveStudentLabel(getStaffFacingName(profile ?? null)),
      cohortId: enrollment.cohort_id,
      courseId: enrollment.course_id,
      deliveryMode: enrollment.delivery_mode as TutorStudentMatchCandidate["deliveryMode"],
    };
  });

  const dedupedStudents = dedupeStudentsById(students);

  const cohorts: TutorCohortMatchCandidate[] = allCohortRows.map((cohort) => {
    const cohortMemberUserIds = (members ?? [])
      .filter((member) => member.cohort_id === cohort.id)
      .map((member) => member.user_id);
    return {
      cohortId: cohort.id,
      cohortName: cohort.name,
      courseId: cohort.course_id,
      memberEmails: cohortMemberUserIds
        .map((userId) => emailByUserId.get(userId))
        .filter((email): email is string => Boolean(email)),
    };
  });

  return {
    students: dedupedStudents,
    cohorts,
  };
}

function dedupeStudentsById(
  students: TutorStudentMatchCandidate[]
): TutorStudentMatchCandidate[] {
  const byId = new Map<string, TutorStudentMatchCandidate>();
  for (const student of students) {
    const existing = byId.get(student.studentId);
    if (!existing) {
      byId.set(student.studentId, student);
      continue;
    }

    const preferNew =
      (!existing.email && student.email) ||
      (student.deliveryMode === "group" && existing.deliveryMode !== "group");
    if (preferNew) {
      byId.set(student.studentId, student);
    }
  }
  return [...byId.values()];
}
