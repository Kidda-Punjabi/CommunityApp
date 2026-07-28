import type { ScheduledSessionRow } from "@/lib/calendar/types";

export type StudentEnrollmentContext = {
  tutorId: string;
  cohortId: string | null;
  deliveryMode: "one_to_one" | "group" | null;
};

export function isSessionVisibleToStudent(
  session: Pick<
    ScheduledSessionRow,
    "tutor_id" | "student_id" | "cohort_id" | "match_method"
  >,
  studentId: string,
  _studentEmail: string,
  enrollments: StudentEnrollmentContext[]
): boolean {
  if (session.match_method === "unmatched" || session.match_method === "title_name") {
    return false;
  }

  const tutorEnrollments = enrollments.filter((entry) => entry.tutorId === session.tutor_id);
  if (tutorEnrollments.length === 0) return false;

  // Explicit 1-to-1 assignment — do not let a same-tutor group enrollment hide it.
  if (session.student_id) {
    return session.student_id === studentId;
  }

  if (session.cohort_id) {
    return tutorEnrollments.some(
      (entry) =>
        entry.deliveryMode === "group" && entry.cohortId === session.cohort_id
    );
  }

  return false;
}
