import type { ScheduledSessionRow } from "@/lib/calendar/types";

export type StudentEnrollmentContext = {
  tutorId: string;
  cohortId: string | null;
  deliveryMode: "one_to_one" | "group" | null;
};

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
    "tutor_id" | "student_id" | "cohort_id" | "attendee_emails" | "match_method"
  >,
  studentId: string,
  studentEmail: string,
  enrollments: StudentEnrollmentContext[]
): boolean {
  if (session.match_method === "unmatched" || session.match_method === "title_name") {
    return false;
  }

  if (!isStudentOnAttendeeList(studentEmail, session.attendee_emails)) {
    return false;
  }

  const enrollment = enrollments.find((entry) => entry.tutorId === session.tutor_id);
  if (!enrollment) return false;

  if (session.student_id) {
    return session.student_id === studentId && enrollment.deliveryMode !== "group";
  }

  if (session.cohort_id) {
    return (
      enrollment.deliveryMode === "group" &&
      enrollment.cohortId === session.cohort_id
    );
  }

  return false;
}
