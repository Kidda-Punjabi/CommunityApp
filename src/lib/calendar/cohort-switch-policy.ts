import { COHORT_SWITCH_CUTOFF_MS } from "@/lib/calendar/constants";
import type { CohortSwitchRequestRow, ScheduledSessionRow } from "@/lib/calendar/types";

export type CohortSwitchEligibility = {
  canRequest: boolean;
  lockedReason: string | null;
};

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
  if (msUntilStart < COHORT_SWITCH_CUTOFF_MS) {
    return {
      canRequest: false,
      lockedReason:
        "You need to let us know at least 3 days before the lesson to request a different cohort.",
    };
  }

  if (alternateCohortCount === 0) {
    return {
      canRequest: false,
      lockedReason: "No other group cohorts are available for this lesson.",
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
      lockedReason: "Your tutor approved joining another cohort — check with them for details.",
    };
  }

  if (options?.rescheduleLimitLockedReason) {
    return {
      canRequest: false,
      lockedReason: options.rescheduleLimitLockedReason,
    };
  }

  return { canRequest: true, lockedReason: null };
}

export const COHORT_SWITCH_WARNING =
  "Group lessons can't be rescheduled — this is the only way to change your session if you can't make your usual group. The Kidda team reviews these requests. Please only ask if you genuinely cannot attend.";

export const GROUP_LESSON_POLICY_NOTE =
  "Group sessions can't be rescheduled. If you can't attend, request a different cohort at least 3 days before the lesson.";
