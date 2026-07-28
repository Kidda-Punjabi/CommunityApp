import type { SupabaseClient } from "@supabase/supabase-js";

export const BEGINNERS_RESCHEDULE_LIMIT = 2;

const COUNTABLE_STATUSES = ["pending", "approved"] as const;

export type BeginnersRescheduleLimitStatus = {
  /** Beginners course id when the student is enrolled; null if not applicable. */
  beginnersCourseId: string | null;
  used: number;
  defaultLimit: number;
  extraAllowance: number;
  totalAllowed: number;
  remaining: number;
  atLimit: boolean;
  lockedReason: string | null;
};

export function getBeginnersRescheduleLockedReason(
  used: number,
  totalAllowed: number
): string {
  return `You've used all ${totalAllowed} reschedule allowance${totalAllowed === 1 ? "" : "s"} for the Beginners course. Please contact Kidda if you need another change.`;
}

export function buildBeginnersRescheduleLimitStatus(
  beginnersCourseId: string | null,
  used: number,
  extraAllowance: number
): BeginnersRescheduleLimitStatus {
  const totalAllowed = BEGINNERS_RESCHEDULE_LIMIT + Math.max(0, extraAllowance);
  const remaining = Math.max(0, totalAllowed - used);
  const atLimit = beginnersCourseId !== null && used >= totalAllowed;

  return {
    beginnersCourseId,
    used,
    defaultLimit: BEGINNERS_RESCHEDULE_LIMIT,
    extraAllowance: Math.max(0, extraAllowance),
    totalAllowed,
    remaining,
    atLimit,
    lockedReason: atLimit ? getBeginnersRescheduleLockedReason(used, totalAllowed) : null,
  };
}

export function appliesBeginnersRescheduleLimit(
  sessionCourseId: string | null | undefined,
  limitStatus: Pick<BeginnersRescheduleLimitStatus, "beginnersCourseId" | "atLimit">
): boolean {
  if (!limitStatus.beginnersCourseId || !sessionCourseId) return false;
  return sessionCourseId === limitStatus.beginnersCourseId && limitStatus.atLimit;
}

async function countRescheduleRequestsForCourse(
  supabase: SupabaseClient,
  studentId: string,
  courseId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("lesson_reschedule_requests")
    .select("id, tutor_scheduled_sessions!inner(course_id)", { count: "exact", head: true })
    .eq("student_id", studentId)
    .in("status", [...COUNTABLE_STATUSES])
    .eq("tutor_scheduled_sessions.course_id", courseId);

  if (error) throw error;
  return count ?? 0;
}

async function countCohortSwitchRequestsForCourse(
  supabase: SupabaseClient,
  studentId: string,
  courseId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("cohort_switch_requests")
    .select("id, tutor_scheduled_sessions!inner(course_id)", { count: "exact", head: true })
    .eq("student_id", studentId)
    .in("status", [...COUNTABLE_STATUSES])
    .eq("tutor_scheduled_sessions.course_id", courseId);

  if (error) throw error;
  return count ?? 0;
}

export async function loadBeginnersRescheduleLimitStatus(
  supabase: SupabaseClient,
  studentId: string
): Promise<BeginnersRescheduleLimitStatus> {
  const { data: beginnersCourse, error: courseError } = await supabase
    .from("courses")
    .select("id")
    .eq("required_tier", "beginners")
    .maybeSingle();

  if (courseError) throw courseError;
  if (!beginnersCourse?.id) {
    return buildBeginnersRescheduleLimitStatus(null, 0, 0);
  }

  const [{ data: enrollment, error: enrollmentError }, rescheduleCount, cohortSwitchCount] =
    await Promise.all([
      supabase
        .from("course_enrollments")
        .select("extra_reschedule_allowance")
        .eq("user_id", studentId)
        .eq("course_id", beginnersCourse.id)
        .maybeSingle(),
      countRescheduleRequestsForCourse(supabase, studentId, beginnersCourse.id),
      countCohortSwitchRequestsForCourse(supabase, studentId, beginnersCourse.id),
    ]);

  if (enrollmentError) throw enrollmentError;

  const extraAllowance = enrollment?.extra_reschedule_allowance ?? 0;
  const used = rescheduleCount + cohortSwitchCount;

  return buildBeginnersRescheduleLimitStatus(beginnersCourse.id, used, extraAllowance);
}
