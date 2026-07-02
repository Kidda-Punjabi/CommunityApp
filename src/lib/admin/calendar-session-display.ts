import type { AdminTutorCalendarSession, AttendeeAccountStatus } from "@/lib/admin/load-admin-tutor-calendars";
import {
  isSessionVisibleToStudent,
  type StudentEnrollmentContext,
} from "@/lib/calendar/session-visibility";
import type { ScheduledSessionRow } from "@/lib/calendar/types";

export type InviteeDotColor = "red" | "yellow";

export function isAdminSessionPersonal(
  session: Pick<AdminTutorCalendarSession, "excludedByTutor">
): boolean {
  return session.excludedByTutor;
}

export function computeInviteeDot(
  session: Pick<
    ScheduledSessionRow,
    "tutor_id" | "student_id" | "cohort_id" | "attendee_emails" | "match_method"
  >,
  excludedByTutor: boolean,
  attendees: AttendeeAccountStatus[],
  matchedStudent: AttendeeAccountStatus | null,
  enrollmentsByUserId: Map<string, StudentEnrollmentContext[]>
): InviteeDotColor | null {
  if (excludedByTutor) return null;

  const people: AttendeeAccountStatus[] = [...attendees];
  if (matchedStudent && !people.some((person) => person.userId === matchedStudent.userId)) {
    people.push(matchedStudent);
  }

  if (people.length === 0) return "yellow";

  let hasRed = false;
  let hasYellow = false;

  for (const person of people) {
    if (!person.hasAccount) {
      hasRed = true;
      continue;
    }
    if (!person.userId || !person.email) {
      hasYellow = true;
      continue;
    }

    const enrollments = enrollmentsByUserId.get(person.userId) ?? [];
    if (!isSessionVisibleToStudent(session, person.userId, person.email, enrollments)) {
      hasYellow = true;
    }
  }

  if (hasRed) return "red";
  if (hasYellow) return "yellow";
  return null;
}

export function formatAttendeeAccountSummary(attendees: AttendeeAccountStatus[]): string {
  if (attendees.length === 0) return "No other attendees on invite";
  return attendees
    .map((attendee) => {
      const label = attendee.displayName ?? attendee.email;
      return attendee.hasAccount ? `${label} · has account` : `${attendee.email} · no account`;
    })
    .join(", ");
}

export function formatInviteeDotSummary(
  dot: InviteeDotColor | null,
  attendees: AttendeeAccountStatus[]
): string | null {
  if (!dot) return null;
  if (dot === "red") {
    const withoutAccount = attendees.filter((attendee) => !attendee.hasAccount);
    if (withoutAccount.length === 0) return "Someone on the invite has no Kidda account";
    return `${withoutAccount.map((a) => a.email).join(", ")} — no Kidda account`;
  }
  return "Has a Kidda account but this lesson is not showing in their schedule yet";
}
