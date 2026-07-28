import { RESCHEDULE_CUTOFF_MS } from "@/lib/calendar/constants";
import type { RescheduleRequestRow, ScheduledSessionRow } from "@/lib/calendar/types";

export type RescheduleEligibility = {
  canRequest: boolean;
  lockedReason: string | null;
};

export const GROUP_LESSON_NO_RESCHEDULE_REASON =
  "Group lessons can't be rescheduled. If you can't attend, request to join a different cohort at least 3 days before the lesson.";

export function getRescheduleEligibility(
  session: Pick<
    ScheduledSessionRow,
    "starts_at" | "rescheduling_allowed" | "status" | "cohort_id"
  >,
  existingRequest: Pick<RescheduleRequestRow, "status"> | null,
  options?: {
    nowMs?: number;
    rescheduleLimitLockedReason?: string | null;
  }
): RescheduleEligibility {
  const nowMs = options?.nowMs ?? Date.now();

  if (session.cohort_id) {
    return { canRequest: false, lockedReason: null };
  }

  if (session.status !== "scheduled") {
    return { canRequest: false, lockedReason: "This lesson is no longer scheduled." };
  }

  if (!session.rescheduling_allowed) {
    return {
      canRequest: false,
      lockedReason:
        "This lesson cannot be rescheduled. Please contact your tutor directly if you have an emergency.",
    };
  }

  const startsAtMs = new Date(session.starts_at).getTime();
  const msUntilStart = startsAtMs - nowMs;

  if (msUntilStart < RESCHEDULE_CUTOFF_MS) {
    return {
      canRequest: false,
      lockedReason:
        "Lessons within 24 hours are locked in. Please contact your tutor directly if you need help.",
    };
  }

  if (existingRequest?.status === "pending") {
    return {
      canRequest: false,
      lockedReason: "You already have a pending reschedule request for this lesson.",
    };
  }

  if (existingRequest?.status === "approved") {
    return {
      canRequest: false,
      lockedReason: "Your tutor approved a reschedule — check your calendar for the updated time.",
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

export function formatSessionWhen(startsAtIso: string, endsAtIso: string): string {
  const start = new Date(startsAtIso);
  const end = new Date(endsAtIso);
  const date = start.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const startTime = start.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
  });
  const endTime = end.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} · ${startTime} – ${endTime}`;
}

export function hoursUntilSession(startsAtIso: string, nowMs = Date.now()): number {
  return (new Date(startsAtIso).getTime() - nowMs) / (60 * 60 * 1000);
}
