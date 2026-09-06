export type TutorCalendarConnectionStatus = {
  connected: boolean;
  googleAccountEmail?: string;
  calendarId?: string;
  connectedAt?: string;
  lastSyncedAt?: string | null;
};

export type ScheduledSessionStatus = "scheduled" | "cancelled" | "completed";
export type SessionAttendanceStatus = "present" | "absent_notified" | "absent_unnotified";

export type ScheduledSessionRow = {
  id: string;
  tutor_id: string;
  google_event_id: string;
  google_recurring_event_id: string | null;
  student_id: string | null;
  cohort_id: string | null;
  course_id: string | null;
  title: string;
  starts_at: string;
  ends_at: string;
  meet_link: string | null;
  location: string | null;
  attendee_emails: string[];
  match_method: "attendee_email" | "title_name" | "manual" | "unmatched" | null;
  rescheduling_allowed: boolean;
  status: ScheduledSessionStatus;
  /** Curriculum week (lessons.lesson_number sequence) for cohort class sessions. */
  week_number?: number | null;
};

export type RescheduleRequestStatus = "pending" | "approved" | "denied" | "cancelled";

export type RescheduleRequestRow = {
  id: string;
  session_id: string;
  student_id: string;
  message: string;
  preferred_times: string | null;
  requested_starts_at?: string | null;
  requested_ends_at?: string | null;
  status: RescheduleRequestStatus;
  tutor_response: string | null;
  resolved_at: string | null;
  created_at: string;
};

export type CohortSwitchRequestStatus = "pending" | "approved" | "denied" | "cancelled";

export type CohortSwitchRequestRow = {
  id: string;
  session_id: string;
  student_id: string;
  from_cohort_id: string;
  to_cohort_id: string;
  to_session_id?: string | null;
  message: string | null;
  status: CohortSwitchRequestStatus;
  tutor_response: string | null;
  resolved_at: string | null;
  created_at: string;
  /** Enriched for student UI when to_session_id is set. */
  toSessionStartsAt?: string | null;
  toSessionEndsAt?: string | null;
  toCohortName?: string | null;
};

export type AlternateCohortOption = {
  id: string;
  cohortId: string;
  name: string;
  tutorName: string;
  startsAt: string;
  endsAt: string;
  lessonLabel: string;
};

export type StudentScheduledSession = ScheduledSessionRow & {
  tutorName: string;
  cohortName: string | null;
  /** Curriculum week: stored week_number for cohort sessions, else derived. */
  lessonNumber: number | null;
  /** e.g. "Lesson 3 — 2 Aug" */
  lessonLabel: string;
  rescheduleRequest: RescheduleRequestRow | null;
  canRequestReschedule: boolean;
  rescheduleLockedReason: string | null;
  /** Within 24h — late-cancel notice only (no new time slot). */
  isLateCancelReschedule: boolean;
  cohortSwitchRequest: CohortSwitchRequestRow | null;
  canRequestCohortSwitch: boolean;
  cohortSwitchLockedReason: string | null;
  /** Within COHORT_SWITCH_CUTOFF_MS of start — request allowed with a warning. */
  isShortNoticeCohortSwitch: boolean;
  alternateCohorts: AlternateCohortOption[];
};

export type TutorScheduledSession = ScheduledSessionRow & {
  studentName: string | null;
  cohortName: string | null;
  pendingRescheduleCount: number;
  linkedPackageId: string | null;
  linkedPackageName: string | null;
  linkedBySeries: boolean;
  linkedLessonCountInPackage: number;
  suggestedPackageId: string | null;
  suggestedPackageName: string | null;
  completed: boolean;
  attendanceMarked: boolean;
  attendanceStatus: SessionAttendanceStatus | null;
  homeworkMarked: boolean;
};

export type GoogleCalendarEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
  hangoutLink: string | null;
  location: string | null;
  attendeeEmails: string[];
  recurringEventId: string | null;
  status?: string;
  updated?: string;
};
// redeploy trigger 1782558287
