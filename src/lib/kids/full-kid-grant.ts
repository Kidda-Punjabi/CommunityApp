import type { SupabaseClient } from "@supabase/supabase-js";

export const FULL_KID_GRANT_PARTS = [
  "cohort_members",
  "course_enrollments",
  "student_packages",
  "course_access",
] as const;

export type FullKidGrantPart = (typeof FULL_KID_GRANT_PARTS)[number];

export function fullKidGrantMissingNote(missing: readonly string[]): string {
  return `missing: ${missing.join(", ")}`;
}

/**
 * A full kids grant is cohort membership, then a group enrollment, then a
 * confirmed package pointing at that enrollment, then course access.
 */
export async function missingFullKidGrantParts(
  supabase: SupabaseClient,
  input: { kidProfileId: string; cohortId: string; courseId: string }
): Promise<FullKidGrantPart[]> {
  const missing: FullKidGrantPart[] = [];

  const { data: cohort, error: cohortError } = await supabase
    .from("cohorts")
    .select("id, tutor_id, course_id")
    .eq("id", input.cohortId)
    .maybeSingle();

  const { data: member, error: memberError } = await supabase
    .from("cohort_members")
    .select("id")
    .eq("cohort_id", input.cohortId)
    .eq("kid_profile_id", input.kidProfileId)
    .is("left_at", null)
    .maybeSingle();
  if (memberError || !member?.id) missing.push("cohort_members");

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("course_enrollments")
    .select("id, tutor_id, delivery_mode, cohort_id")
    .eq("kid_profile_id", input.kidProfileId)
    .eq("course_id", input.courseId)
    .maybeSingle();

  const enrollmentOk =
    !enrollmentError &&
    !cohortError &&
    cohort?.id &&
    cohort.course_id === input.courseId &&
    enrollment?.id &&
    enrollment.delivery_mode === "group" &&
    enrollment.cohort_id === input.cohortId &&
    (enrollment.tutor_id ?? null) === (cohort.tutor_id ?? null);
  if (!enrollmentOk) missing.push("course_enrollments");

  const { data: packages, error: packageError } = await supabase
    .from("student_packages")
    .select("id, status, enrollment_id, kid_profile_id")
    .eq("kid_profile_id", input.kidProfileId)
    .eq("course_id", input.courseId);

  const packageOk =
    !packageError &&
    (packages ?? []).some(
      (row) =>
        row.kid_profile_id === input.kidProfileId &&
        row.status === "confirmed" &&
        row.enrollment_id &&
        (!enrollment?.id || row.enrollment_id === enrollment.id)
    );
  if (!packageOk) missing.push("student_packages");

  const { data: access, error: accessError } = await supabase
    .from("course_access")
    .select("course_id")
    .eq("kid_profile_id", input.kidProfileId)
    .eq("course_id", input.courseId)
    .maybeSingle();
  if (accessError || !access?.course_id) missing.push("course_access");

  return missing;
}
