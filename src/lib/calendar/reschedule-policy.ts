import { RESCHEDULE_CUTOFF_MS } from "@/lib/calendar/constants";
import { UK_DISPLAY_TIMEZONE } from "@/lib/calendar/uk-display-time";
import type { RescheduleRequestRow, ScheduledSessionRow } from "@/lib/calendar/types";

export type RescheduleEligibility = {
  canRequest: boolean;
  lockedReason: string | null;
  /** Within 24h of start — student can only send a late-cancel notice (no new slot). */
  isLateCancel?: boolean;
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

  if (msUntilStart < 0) {
    return {
      canRequest: false,
      lockedReason: "This lesson has already started or passed.",
    };
  }

  const isLateCancel = msUntilStart < RESCHEDULE_CUTOFF_MS;

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

  if (existingRequest?.status === "denied") {
    return {
      canRequest: false,
      lockedReason:
        "Your late cancel was recorded. If Session catch-up is available, it will show on this lesson once unlocked.",
    };
  }

  if (options?.rescheduleLimitLockedReason) {
    return {
      canRequest: false,
      lockedReason: options.rescheduleLimitLockedReason,
    };
  }

  return { canRequest: true, lockedReason: null, isLateCancel };
}

export function formatSessionWhen(startsAtIso: string, endsAtIso: string): string {
  const start = new Date(startsAtIso);
  const end = new Date(endsAtIso);
  const tz = UK_DISPLAY_TIMEZONE;
  const date = start.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: tz,
  });
  const startTime = start.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
  const endTime = end.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
  return `${date} · ${startTime} – ${endTime}`;
}

export function hoursUntilSession(startsAtIso: string, nowMs = Date.now()): number {
  return (new Date(startsAtIso).getTime() - nowMs) / (60 * 60 * 1000);
}
