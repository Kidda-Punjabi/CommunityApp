import { COHORT_SWITCH_CUTOFF_MS, NO_MATCHING_ALTERNATE_SESSION_COPY, SESSION_SWITCH_LIMIT } from "@/lib/calendar/constants";
import type { CohortSwitchRequestRow, ScheduledSessionRow } from "@/lib/calendar/types";

export type CohortSwitchEligibility = {
  canRequest: boolean;
  lockedReason: string | null;
  /** Within COHORT_SWITCH_CUTOFF_MS of start — allowed, but student sees a short-notice warning. */
  isShortNotice?: boolean;
};

export const COHORT_SWITCH_SHORT_NOTICE_WARNING =
  "This is short notice — we may not be able to accommodate it.";

export function getSessionSwitchCapError(used: number, pendingCount: number): string | null {
  if (used >= SESSION_SWITCH_LIMIT) {
    return `You've already used your ${SESSION_SWITCH_LIMIT} session switches for this course. Please contact Kidda if you need another change.`;
  }
  if (used + pendingCount >= SESSION_SWITCH_LIMIT) {
    return `You already have a pending session switch, and you've used your remaining allowance for this course (${SESSION_SWITCH_LIMIT} total).`;
  }
  return null;
}

export function getCohortSwitchEligibility(
  session: Pick<ScheduledSessionRow, "starts_at" | "status" | "cohort_id">,
  existingRequest: Pick<CohortSwitchRequestRow, "status" | "calendar_synced_at" | "sync_error"> | null,
  alternateCohortCount: number,
  options?: {
    nowMs?: number;
    sessionSwitchCapReason?: string | null;
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
      lockedReason: "You already have a pending session switch request for this class.",
    };
  }

  if (existingRequest?.status === "approved") {
    const synced = Boolean(existingRequest.calendar_synced_at);
    return {
      canRequest: false,
      lockedReason: synced
        ? "This class has already been switched — check your calendar for the updated invite."
        : existingRequest.sync_error
          ? "Your session switch was approved, but the calendar update needs Kidda to retry it."
          : "Your session switch was approved — we're updating your calendar invite.",
    };
  }

  if (options?.sessionSwitchCapReason) {
    return {
      canRequest: false,
      lockedReason: options.sessionSwitchCapReason,
    };
  }

  return { canRequest: true, lockedReason: null, isShortNotice };
}

export const COHORT_SWITCH_WARNING =
  "This swaps you into another cohort's class for this week only — it is not a permanent cohort move. The Kidda team reviews these requests. Please only ask if you genuinely cannot attend.";

export const GROUP_LESSON_POLICY_NOTE =
  "Group sessions can't be rescheduled. If you'll miss this class, you can switch into another cohort's equivalent session when one is running around the same date.";
