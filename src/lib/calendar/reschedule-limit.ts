import type { ScheduledSessionRow } from "@/lib/calendar/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Default cancellations/reschedules per Beginners course enrollment (1-to-1 or group pool). */
export const BEGINNERS_RESCHEDULE_LIMIT = 4;

/** Pending and approved count toward the allowance; cancelled/denied do not. */
const COUNTABLE_STATUSES = ["pending", "approved"] as const;

export type BeginnersReschedulePoolStatus = {
  used: number;
  defaultLimit: number;
  extraAllowance: number;
  totalAllowed: number;
  remaining: number;
  atLimit: boolean;
  lockedReason: string | null;
};

export type BeginnersRescheduleLimitStatus = {
  /** Beginners course id when the student is enrolled; null if not applicable. */
  beginnersCourseId: string | null;
  oneToOne: BeginnersReschedulePoolStatus;
  group: BeginnersReschedulePoolStatus;
};

function isMissingColumnError(message: string | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("extra_reschedule_allowance") ||
    lower.includes("schema cache") ||
    lower.includes("does not exist")
  );
}

function buildPoolStatus(
  used: number,
  extraAllowance: number,
  pool: "one_to_one" | "group",
  beginnersCourseId: string | null
): BeginnersReschedulePoolStatus {
  const totalAllowed = BEGINNERS_RESCHEDULE_LIMIT + Math.max(0, extraAllowance);
  const remaining = Math.max(0, totalAllowed - used);
  const atLimit = beginnersCourseId !== null && used >= totalAllowed;

  return {
    used,
    defaultLimit: BEGINNERS_RESCHEDULE_LIMIT,
    extraAllowance: Math.max(0, extraAllowance),
    totalAllowed,
    remaining,
    atLimit,
    lockedReason: atLimit
      ? pool === "one_to_one"
        ? `You've used all ${totalAllowed} 1-to-1 reschedule allowance${totalAllowed === 1 ? "" : "s"} for the Beginners course. Please contact Kidda if you need another change.`
        : `You've used all ${totalAllowed} alternate cohort request${totalAllowed === 1 ? "" : "s"} for the Beginners course. Please contact Kidda if you need another change.`
      : null,
  };
}

export function buildBeginnersRescheduleLimitStatus(
  beginnersCourseId: string | null,
  oneToOneUsed: number,
  groupUsed: number,
  extraOneToOneAllowance: number,
  extraGroupAllowance: number
): BeginnersRescheduleLimitStatus {
  return {
    beginnersCourseId,
    oneToOne: buildPoolStatus(
      oneToOneUsed,
      extraOneToOneAllowance,
      "one_to_one",
      beginnersCourseId
    ),
    group: buildPoolStatus(groupUsed, extraGroupAllowance, "group", beginnersCourseId),
  };
}

export function appliesBeginnersRescheduleLimit(
  session: Pick<ScheduledSessionRow, "course_id" | "cohort_id">,
  limitStatus: BeginnersRescheduleLimitStatus
): boolean {
  if (!limitStatus.beginnersCourseId || !session.course_id) return false;
  if (session.course_id !== limitStatus.beginnersCourseId) return false;
  return session.cohort_id ? limitStatus.group.atLimit : limitStatus.oneToOne.atLimit;
}

export function getBeginnersRescheduleLockedReason(
  session: Pick<ScheduledSessionRow, "cohort_id">,
  limitStatus: BeginnersRescheduleLimitStatus
): string | null {
  const pool = session.cohort_id ? limitStatus.group : limitStatus.oneToOne;
  return pool.lockedReason;
}

async function countRescheduleRequestsForCourse(
  supabase: SupabaseClient,
  studentId: string,
  courseId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("lesson_reschedule_requests")
    .select("id, tutor_scheduled_sessions!inner(course_id)")
    .eq("student_id", studentId)
    .in("status", [...COUNTABLE_STATUSES])
    .eq("tutor_scheduled_sessions.course_id", courseId);

  if (error) {
    console.error("countRescheduleRequestsForCourse:", error.message || error);
    return 0;
  }
  return data?.length ?? 0;
}

async function countCohortSwitchRequestsForCourse(
  supabase: SupabaseClient,
  studentId: string,
  courseId: string
): Promise<number> {
  // Disambiguate: cohort_switch_requests has both session_id and to_session_id FKs.
  const { data, error } = await supabase
    .from("cohort_switch_requests")
    .select("id, tutor_scheduled_sessions!session_id!inner(course_id)")
    .eq("student_id", studentId)
    .in("status", [...COUNTABLE_STATUSES])
    .eq("tutor_scheduled_sessions.course_id", courseId);

  if (error) {
    console.error("countCohortSwitchRequestsForCourse:", error.message || error);
    return 0;
  }
  return data?.length ?? 0;
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
    return buildBeginnersRescheduleLimitStatus(null, 0, 0, 0, 0);
  }

  const [enrollmentResult, rescheduleCount, cohortSwitchCount] = await Promise.all([
    supabase
      .from("course_enrollments")
      .select("extra_reschedule_allowance, delivery_mode")
      .eq("user_id", studentId)
      .eq("course_id", beginnersCourse.id)
      .maybeSingle(),
    countRescheduleRequestsForCourse(supabase, studentId, beginnersCourse.id),
    countCohortSwitchRequestsForCourse(supabase, studentId, beginnersCourse.id),
  ]);

  let extraAllowance = 0;
  let deliveryMode: "one_to_one" | "group" | null = null;
  if (enrollmentResult.error) {
    if (!isMissingColumnError(enrollmentResult.error.message)) {
      console.error(
        "loadBeginnersRescheduleLimitStatus enrollment:",
        enrollmentResult.error.message || enrollmentResult.error
      );
    }
  } else {
    extraAllowance = enrollmentResult.data?.extra_reschedule_allowance ?? 0;
    deliveryMode =
      enrollmentResult.data?.delivery_mode === "one_to_one" ||
      enrollmentResult.data?.delivery_mode === "group"
        ? enrollmentResult.data.delivery_mode
        : null;
  }

  const extraOneToOne = deliveryMode === "one_to_one" ? extraAllowance : 0;
  const extraGroup = deliveryMode === "group" ? extraAllowance : 0;

  return buildBeginnersRescheduleLimitStatus(
    beginnersCourse.id,
    rescheduleCount,
    cohortSwitchCount,
    extraOneToOne,
    extraGroup
  );
}
