import type { ScheduledSessionRow } from "@/lib/calendar/types";

export function isStudentOnAttendeeList(
  studentEmail: string,
  attendeeEmails: string[]
): boolean {
  const normalized = studentEmail.trim().toLowerCase();
  if (!normalized) return false;

  return attendeeEmails.some((email) => email.trim().toLowerCase() === normalized);
}

export function isSessionVisibleToStudent(
  session: Pick<
    ScheduledSessionRow,
    "student_id" | "cohort_id" | "attendee_emails" | "match_method"
  >,
  studentId: string,
  studentEmail: string
): boolean {
  if (session.match_method === "unmatched" || session.match_method === "title_name") {
    return false;
  }

  if (!isStudentOnAttendeeList(studentEmail, session.attendee_emails)) {
    return false;
  }

  if (session.student_id) {
    return session.student_id === studentId;
  }

  if (session.cohort_id) {
    return true;
  }

  return false;
}
