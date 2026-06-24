import type { SupabaseClient } from "@supabase/supabase-js";
import { getDisplayName } from "@/lib/profile/display-name";
import type {
  TutorCohortMatchCandidate,
  TutorStudentMatchCandidate,
} from "@/lib/calendar/match-events";

export async function loadTutorMatchCandidates(
  adminClient: SupabaseClient,
  tutorId: string
): Promise<{ students: TutorStudentMatchCandidate[]; cohorts: TutorCohortMatchCandidate[] }> {
  const { data: enrollments, error } = await adminClient
    .from("course_enrollments")
    .select("user_id, course_id, cohort_id")
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

  const { data: authUsers } = await adminClient.auth.admin.listUsers({ perPage: 1000 });

  const emailByUserId = new Map<string, string>();
  for (const user of authUsers.users) {
    if (user.email) emailByUserId.set(user.id, user.email.toLowerCase());
  }

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  const students: TutorStudentMatchCandidate[] = (enrollments ?? []).map((enrollment) => {
    const profile = profileById.get(enrollment.user_id);
    const email = emailByUserId.get(enrollment.user_id) ?? "";
    return {
      studentId: enrollment.user_id,
      email,
      displayName: getDisplayName(profile ?? null) ?? "Student",
      cohortId: enrollment.cohort_id,
      courseId: enrollment.course_id,
    };
  });

  const cohorts: TutorCohortMatchCandidate[] = allCohortRows.map((cohort) => {
    const memberUserIds = (members ?? [])
      .filter((member) => member.cohort_id === cohort.id)
      .map((member) => member.user_id);
    return {
      cohortId: cohort.id,
      cohortName: cohort.name,
      courseId: cohort.course_id,
      memberEmails: memberUserIds
        .map((userId) => emailByUserId.get(userId))
        .filter((email): email is string => Boolean(email)),
    };
  });

  return { students, cohorts };
}
