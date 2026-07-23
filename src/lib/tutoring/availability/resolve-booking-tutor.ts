import type { SupabaseClient } from "@supabase/supabase-js";
import { getPackageCatalogEntry } from "@/lib/packages/catalog";
import { getDisplayName } from "@/lib/profile/display-name";
import { loadTutorAvailability } from "./load-availability";

type EnrollmentRow = {
  id: string;
  course_id: string;
  tutor_id: string | null;
  delivery_mode: "one_to_one" | "group" | null;
  student_package_id: string | null;
};

async function packageSlugForEnrollment(
  supabase: SupabaseClient,
  enrollment: EnrollmentRow
): Promise<string | null> {
  if (!enrollment.student_package_id) return null;
  const { data } = await supabase
    .from("student_packages")
    .select("packages(slug)")
    .eq("id", enrollment.student_package_id)
    .maybeSingle();
  const rel = data?.packages as { slug?: string } | Array<{ slug?: string }> | null;
  const slug = Array.isArray(rel) ? rel[0]?.slug : rel?.slug;
  return slug ?? null;
}

/** Live 1-1 style packages (not group cohort). */
export function isOneToOneStyleEnrollment(
  enrollment: EnrollmentRow,
  packageSlug: string | null
): boolean {
  if (enrollment.delivery_mode === "group") return false;
  if (enrollment.delivery_mode === "one_to_one") return true;
  if (packageSlug) {
    const catalog = getPackageCatalogEntry(packageSlug);
    if (catalog?.deliveryMode === "one_to_one") return true;
    if (packageSlug === "foundational") return true;
  }
  return false;
}

export type ResolvedBookingTutor = {
  tutorId: string;
  tutorName: string;
  enrollmentId: string | null;
  courseId: string | null;
  bookingEnabled: boolean;
  hasAvailabilityWindows: boolean;
};

async function tutorIsBookable(
  supabase: SupabaseClient,
  tutorId: string
): Promise<{ bookable: boolean; settings: Awaited<ReturnType<typeof loadTutorAvailability>>["settings"] }> {
  const availability = await loadTutorAvailability(supabase, tutorId);
  const bookable =
    availability.schemaReady &&
    availability.settings.oneToOneBookingEnabled &&
    availability.windows.length > 0;
  return { bookable, settings: availability.settings };
}

async function profileTutorName(
  supabase: SupabaseClient,
  tutorId: string
): Promise<string> {
  const { data: tutorProfile } = await supabase
    .from("profiles")
    .select("full_name, preferred_name")
    .eq("id", tutorId)
    .maybeSingle();
  return tutorProfile ? (getDisplayName(tutorProfile) ?? "Your tutor") : "Your tutor";
}

/**
 * Picks the tutor for self-serve 1-1 booking.
 * Prefer the course/tutor on the oldest available session credit; otherwise the
 * student's 1-1-style enrollment tutor; finally the sole bookable tutor.
 */
export async function resolveStudentBookingTutor(
  supabase: SupabaseClient,
  studentId: string,
  options?: { preferredCourseId?: string | null; preferredTutorId?: string | null }
): Promise<ResolvedBookingTutor | null> {
  const preferredCourseId = options?.preferredCourseId?.trim() || null;
  const preferredTutorId = options?.preferredTutorId?.trim() || null;

  if (preferredCourseId || preferredTutorId) {
    const fromCredit = await resolveFromCourseOrTutor(
      supabase,
      studentId,
      preferredCourseId,
      preferredTutorId
    );
    if (fromCredit) return fromCredit;
  }

  const { data: enrollments, error } = await supabase
    .from("course_enrollments")
    .select("id, course_id, tutor_id, delivery_mode, student_package_id")
    .eq("user_id", studentId)
    .not("tutor_id", "is", null);

  if (error) throw error;

  const rows = (enrollments ?? []) as EnrollmentRow[];
  const oneToOneCandidates: Array<{
    enrollment: EnrollmentRow;
    packageSlug: string | null;
  }> = [];

  for (const enrollment of rows) {
    const packageSlug = await packageSlugForEnrollment(supabase, enrollment);
    if (isOneToOneStyleEnrollment(enrollment, packageSlug) && enrollment.tutor_id) {
      oneToOneCandidates.push({ enrollment, packageSlug });
    }
  }

  for (const { enrollment } of oneToOneCandidates) {
    const tutorId = enrollment.tutor_id!;
    const { bookable } = await tutorIsBookable(supabase, tutorId);
    if (bookable) {
      return {
        tutorId,
        tutorName: await profileTutorName(supabase, tutorId),
        enrollmentId: enrollment.id,
        courseId: enrollment.course_id,
        bookingEnabled: true,
        hasAvailabilityWindows: true,
      };
    }
  }

  if (oneToOneCandidates.length > 0) {
    const { enrollment } = oneToOneCandidates[0]!;
    const tutorId = enrollment.tutor_id!;
    const { bookable } = await tutorIsBookable(supabase, tutorId);

    return {
      tutorId,
      tutorName: await profileTutorName(supabase, tutorId),
      enrollmentId: enrollment.id,
      courseId: enrollment.course_id,
      bookingEnabled: bookable,
      hasAvailabilityWindows: bookable,
    };
  }

  const { data: enabledSettings } = await supabase
    .from("tutor_availability_settings")
    .select("tutor_id")
    .eq("one_to_one_booking_enabled", true);

  const enabledIds = (enabledSettings ?? []).map((row) => row.tutor_id as string);
  const bookableTutorIds: string[] = [];
  for (const tutorId of enabledIds) {
    const { bookable } = await tutorIsBookable(supabase, tutorId);
    if (bookable) bookableTutorIds.push(tutorId);
  }

  if (bookableTutorIds.length === 1) {
    const tutorId = bookableTutorIds[0]!;
    return {
      tutorId,
      tutorName: await profileTutorName(supabase, tutorId),
      enrollmentId: null,
      courseId: null,
      bookingEnabled: true,
      hasAvailabilityWindows: true,
    };
  }

  return null;
}

async function resolveFromCourseOrTutor(
  supabase: SupabaseClient,
  studentId: string,
  courseId: string | null,
  tutorIdHint: string | null
): Promise<ResolvedBookingTutor | null> {
  if (courseId) {
    const { data: enrollment } = await supabase
      .from("course_enrollments")
      .select("id, course_id, tutor_id, delivery_mode")
      .eq("user_id", studentId)
      .eq("course_id", courseId)
      .maybeSingle();

    const tutorId = (enrollment?.tutor_id as string | null) ?? tutorIdHint;
    if (!tutorId) return null;

    const { bookable } = await tutorIsBookable(supabase, tutorId);
    return {
      tutorId,
      tutorName: await profileTutorName(supabase, tutorId),
      enrollmentId: (enrollment?.id as string | undefined) ?? null,
      courseId,
      bookingEnabled: bookable,
      hasAvailabilityWindows: bookable,
    };
  }

  if (tutorIdHint) {
    const { bookable } = await tutorIsBookable(supabase, tutorIdHint);
    const { data: enrollment } = await supabase
      .from("course_enrollments")
      .select("id, course_id")
      .eq("user_id", studentId)
      .eq("tutor_id", tutorIdHint)
      .neq("delivery_mode", "group")
      .limit(1)
      .maybeSingle();

    return {
      tutorId: tutorIdHint,
      tutorName: await profileTutorName(supabase, tutorIdHint),
      enrollmentId: (enrollment?.id as string | undefined) ?? null,
      courseId: (enrollment?.course_id as string | undefined) ?? null,
      bookingEnabled: bookable,
      hasAvailabilityWindows: bookable,
    };
  }

  return null;
}
