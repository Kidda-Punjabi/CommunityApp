import { RESCHEDULE_CUTOFF_MS } from "@/lib/calendar/constants";
import type { RescheduleRequestRow, ScheduledSessionRow } from "@/lib/calendar/types";

export type RescheduleEligibility = {
  canRequest: boolean;
  lockedReason: string | null;
};

export function getRescheduleEligibility(
  session: Pick<
    ScheduledSessionRow,
    "starts_at" | "rescheduling_allowed" | "status"
  >,
  existingRequest: Pick<RescheduleRequestRow, "status"> | null,
  nowMs = Date.now()
): RescheduleEligibility {
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

  return { canRequest: true, lockedReason: null };
}

export function formatSessionWhen(startsAtIso: string, endsAtIso: string): string {
  const start = new Date(startsAtIso);
  const end = new Date(endsAtIso);
  const date = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const startTime = start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const endTime = end.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} · ${startTime} – ${endTime}`;
}

export function hoursUntilSession(startsAtIso: string, nowMs = Date.now()): number {
  return (new Date(startsAtIso).getTime() - nowMs) / (60 * 60 * 1000);
}
