import type { ScheduledSessionRow } from "@/lib/calendar/types";

const INTERNAL_EMAIL_DOMAIN = "@kidda.app";

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
