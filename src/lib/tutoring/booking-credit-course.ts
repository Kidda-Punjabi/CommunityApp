import { getCheckoutConfig } from "@/lib/products/checkout";
import type { SupabaseClient } from "@supabase/supabase-js";

export type BookingCreditCourseScope = {
  courseId: string;
  tutorId: string | null;
};

const TIER_BY_CHECKOUT_KEY: Record<string, "foundational" | "beginners" | "community"> = {
  "foundational-refresher": "foundational",
  "foundational-full": "foundational",
  "beginners-one-to-one": "beginners",
  "beginners-group": "beginners",
  beginners: "beginners",
  community: "community",
  // "one-to-one-session" is course-agnostic — require metadata.course_id.
};

/** Resolve course UUID from a paid-course tier. */
export async function courseIdForTier(
  supabase: SupabaseClient,
  tier: "foundational" | "beginners" | "community"
): Promise<string | null> {
  const { data } = await supabase
    .from("courses")
    .select("id")
    .eq("required_tier", tier)
    .order("display_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function courseIdFromCheckoutKey(
  supabase: SupabaseClient,
  checkoutKey: string | null | undefined
): Promise<string | null> {
  if (!checkoutKey) return null;
  const config = getCheckoutConfig(checkoutKey);
  const tier =
    TIER_BY_CHECKOUT_KEY[checkoutKey] ??
    (config?.productSlug === "foundational" ||
    config?.productSlug === "beginners" ||
    config?.productSlug === "community"
      ? config.productSlug
      : null);
  if (!tier) return null;
  return courseIdForTier(supabase, tier);
}

/**
 * Tutor assigned on the student's enrollment for this course (prefer one_to_one).
 */
export async function tutorIdForStudentCourse(
  supabase: SupabaseClient,
  studentId: string,
  courseId: string
): Promise<string | null> {
  const { data: rows } = await supabase
    .from("course_enrollments")
    .select("tutor_id, delivery_mode")
    .eq("user_id", studentId)
    .eq("course_id", courseId)
    .not("tutor_id", "is", null);

  const enrollments = rows ?? [];
  const oneToOne = enrollments.find((row) => row.delivery_mode === "one_to_one");
  if (oneToOne?.tutor_id) return oneToOne.tutor_id as string;
  const any = enrollments.find((row) => row.tutor_id);
  return (any?.tutor_id as string | undefined) ?? null;
}

export async function resolveBookingCreditCourseScope(
  supabase: SupabaseClient,
  params: {
    studentId: string;
    courseIdFromMeta?: string | null;
    tutorIdFromMeta?: string | null;
    checkoutKey?: string | null;
  }
): Promise<BookingCreditCourseScope | null> {
  const courseId =
    params.courseIdFromMeta?.trim() ||
    (await courseIdFromCheckoutKey(supabase, params.checkoutKey)) ||
    null;
  if (!courseId) return null;

  const tutorId =
    params.tutorIdFromMeta?.trim() ||
    (await tutorIdForStudentCourse(supabase, params.studentId, courseId));

  return { courseId, tutorId };
}

/**
 * Infer course for a pending/confirmed booking when Stripe metadata is missing
 * (e.g. payment-link checkouts). Prefers an explicit one_to_one enrollment with
 * the booking's tutor; returns null when ambiguous.
 */
export async function inferCourseScopeFromBookingTutor(
  supabase: SupabaseClient,
  studentId: string,
  tutorId: string
): Promise<BookingCreditCourseScope | null> {
  const { data: rows } = await supabase
    .from("course_enrollments")
    .select("course_id, tutor_id, delivery_mode")
    .eq("user_id", studentId)
    .eq("tutor_id", tutorId);

  const oneToOne = (rows ?? []).filter((row) => row.delivery_mode === "one_to_one");
  if (oneToOne.length === 1 && oneToOne[0]?.course_id) {
    return {
      courseId: oneToOne[0].course_id as string,
      tutorId,
    };
  }

  // Foundational often has null delivery_mode historically — treat non-group as 1-1-ish
  // only when exactly one such enrollment shares this tutor.
  const nonGroup = (rows ?? []).filter((row) => row.delivery_mode !== "group");
  if (nonGroup.length === 1 && nonGroup[0]?.course_id) {
    return {
      courseId: nonGroup[0].course_id as string,
      tutorId,
    };
  }

  return null;
}
