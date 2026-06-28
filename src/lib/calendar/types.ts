export type TutorCalendarConnectionStatus = {
  connected: boolean;
  googleAccountEmail?: string;
  calendarId?: string;
  connectedAt?: string;
  lastSyncedAt?: string | null;
};

export type ScheduledSessionStatus = "scheduled" | "cancelled" | "completed";

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
};

export type RescheduleRequestStatus = "pending" | "approved" | "denied" | "cancelled";

export type RescheduleRequestRow = {
  id: string;
  session_id: string;
  student_id: string;
  message: string;
  preferred_times: string | null;
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
  message: string | null;
  status: CohortSwitchRequestStatus;
  tutor_response: string | null;
  resolved_at: string | null;
  created_at: string;
};

export type AlternateCohortOption = {
  id: string;
  name: string;
};

export type StudentScheduledSession = ScheduledSessionRow & {
  tutorName: string;
  cohortName: string | null;
  rescheduleRequest: RescheduleRequestRow | null;
  canRequestReschedule: boolean;
  rescheduleLockedReason: string | null;
  cohortSwitchRequest: CohortSwitchRequestRow | null;
  canRequestCohortSwitch: boolean;
  cohortSwitchLockedReason: string | null;
  alternateCohorts: AlternateCohortOption[];
};

export type TutorScheduledSession = ScheduledSessionRow & {
  studentName: string | null;
  cohortName: string | null;
  pendingRescheduleCount: number;
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
