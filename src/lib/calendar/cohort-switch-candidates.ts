import type { ScheduledSessionRow } from "@/lib/calendar/types";

const INTERNAL_EMAIL_DOMAIN = "@kidda.app";

/** Cohort lifecycle statuses that can still accept a same-week switch. */
export const ACTIVE_COHORT_SWITCH_STATUSES = [
  "pre_scheduling",
  "recruiting",
  "scheduled",
  "in_progress",
  "paused",
] as const;

export type ActiveCohortSwitchStatus = (typeof ACTIVE_COHORT_SWITCH_STATUSES)[number];

export function isActiveCohortSwitchStatus(status: string | null | undefined): boolean {
  if (!status) return true;
  return (ACTIVE_COHORT_SWITCH_STATUSES as readonly string[]).includes(status);
}

export function isValidCohortSwitchCandidateSession(
  session: Pick<ScheduledSessionRow, "cohort_id" | "title" | "attendee_emails">
): boolean {
  if (!session.cohort_id) return false;

  const title = session.title.trim().toLowerCase();
  if (title.includes("meeting")) return false;

  const hasExternalAttendee = session.attendee_emails.some((email) => {
    const normalized = email.trim().toLowerCase();
    return normalized.length > 0 && !normalized.endsWith(INTERNAL_EMAIL_DOMAIN);
  });

  const looksLikeClass = title.includes("class") || title.includes("cohort");
  return looksLikeClass || hasExternalAttendee;
}

/** Alternate session for a group reschedule: same course + tutor, other active cohort. */
export function isAlternateCohortSwitchSession(
  source: Pick<ScheduledSessionRow, "id" | "course_id" | "tutor_id" | "cohort_id">,
  candidate: Pick<ScheduledSessionRow, "id" | "course_id" | "tutor_id" | "cohort_id" | "status" | "starts_at">,
  options?: { nowMs?: number }
): boolean {
  const nowMs = options?.nowMs ?? Date.now();
  if (!source.cohort_id || !source.course_id || !candidate.cohort_id || !candidate.course_id) {
    return false;
  }
  if (candidate.id === source.id) return false;
  if (candidate.cohort_id === source.cohort_id) return false;
  if (candidate.course_id !== source.course_id) return false;
  if (candidate.tutor_id !== source.tutor_id) return false;
  if (candidate.status !== "scheduled") return false;
  return new Date(candidate.starts_at).getTime() >= nowMs;
}
