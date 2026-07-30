import type { ScheduledSessionRow } from "@/lib/calendar/types";
import type { StudentEnrollmentContext } from "@/lib/calendar/session-visibility";

/**
 * Keep group cohort sessions as-is. For 1-to-1 courses, drop calendar-sync guesses
 * (attendee_email) and, when a package recurring series exists, only keep that
 * stream plus separate manual one-off bookings.
 */
export function filterStudentScheduleSessions<T extends ScheduledSessionRow>(
  sessions: T[],
  enrollments: StudentEnrollmentContext[],
  primarySeriesByCourseId: Map<string, string>
): T[] {
  const oneToOneCourseIds = new Set(
    enrollments
      .filter((entry) => entry.deliveryMode === "one_to_one" && entry.courseId)
      .map((entry) => entry.courseId as string)
  );

  return sessions.filter((session) => {
    if (session.cohort_id) return true;
    if (!session.student_id || !session.course_id) return true;
    if (!oneToOneCourseIds.has(session.course_id)) return true;

    if (session.match_method === "attendee_email") return false;

    const primarySeries = primarySeriesByCourseId.get(session.course_id);
    if (!primarySeries) {
      return session.match_method === "manual";
    }

    if (session.google_recurring_event_id === primarySeries) return true;

    if (session.match_method === "manual" && !session.google_recurring_event_id) {
      return true;
    }

    return false;
  });
}
