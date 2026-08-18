import { COHORT_SWITCH_CUTOFF_MS, NO_MATCHING_ALTERNATE_SESSION_COPY } from "@/lib/calendar/constants";
import type { CohortSwitchRequestRow, ScheduledSessionRow } from "@/lib/calendar/types";

export type CohortSwitchEligibility = {
  canRequest: boolean;
  lockedReason: string | null;
  /** Within COHORT_SWITCH_CUTOFF_MS of start — allowed, but student sees a short-notice warning. */
  isShortNotice?: boolean;
};

export const COHORT_SWITCH_SHORT_NOTICE_WARNING =
  "This is short notice — we may not be able to accommodate it.";

export function getCohortSwitchEligibility(
  session: Pick<ScheduledSessionRow, "starts_at" | "status" | "cohort_id">,
  existingRequest: Pick<CohortSwitchRequestRow, "status"> | null,
  alternateCohortCount: number,
  options?: {
    nowMs?: number;
    rescheduleLimitLockedReason?: string | null;
  }
): CohortSwitchEligibility {
  const nowMs = options?.nowMs ?? Date.now();

  if (!session.cohort_id) {
    return { canRequest: false, lockedReason: null };
  }

  if (session.status !== "scheduled") {
    return { canRequest: false, lockedReason: "This lesson is no longer scheduled." };
  }

  const msUntilStart = new Date(session.starts_at).getTime() - nowMs;
  if (msUntilStart <= 0) {
    return {
      canRequest: false,
      lockedReason: "This lesson has already started or passed.",
    };
  }

  const isShortNotice = msUntilStart < COHORT_SWITCH_CUTOFF_MS;

  if (alternateCohortCount === 0) {
    return {
      canRequest: false,
      lockedReason: NO_MATCHING_ALTERNATE_SESSION_COPY,
    };
  }

  if (existingRequest?.status === "pending") {
    return {
      canRequest: false,
      lockedReason: "You already have a pending alternate cohort request for this lesson.",
    };
  }

  if (existingRequest?.status === "approved") {
    return {
      canRequest: false,
      lockedReason: "Your alternate cohort request was approved — check your schedule for details.",
    };
  }

  // cancelled / denied do not block a new request and do not count toward the reschedule limit.

  if (options?.rescheduleLimitLockedReason) {
    return {
      canRequest: false,
      lockedReason: options.rescheduleLimitLockedReason,
    };
  }

  return { canRequest: true, lockedReason: null, isShortNotice };
}

export const COHORT_SWITCH_WARNING =
  "Group lessons can't be rescheduled — this is the only way to change your session if you can't make your usual group. The Kidda team reviews these requests. Please only ask if you genuinely cannot attend.";

export const GROUP_LESSON_POLICY_NOTE =
  "Group sessions can't be rescheduled. If you can't attend, request a matching alternate session — short-notice requests may not be accommodated.";
