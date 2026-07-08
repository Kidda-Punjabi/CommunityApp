export const SALES_CALL_OUTCOMES = [
  "Enrolment Call Booked",
  "Check-In Call Booked",
  "No Show",
  "Not Interested",
  "Can't Afford",
  "Follow Up",
  "Closed",
  "Rebook",
  "Refunded",
  "Interested in Kids Classes",
  "Interested in Sikhi Classes",
  "Interested in Reading/Writing",
  "Rescheduled",
  "Cancelled",
] as const;

export const SALES_CALL_MECHANISMS = ["Text", "Phone Call", "Video Call", "Email"] as const;

export const SALES_CALL_COURSES = [
  "Beginners Course",
  "Foundational Course",
  "Refreshers Course",
  "Community",
  "Private Tuition",
] as const;

export const SALES_CALL_DELIVERIES = ["Group", "1-1", "Community - Obsolete"] as const;

export const SALES_CALL_RANKINGS = ["F", "C", "B", "A", "S"] as const;

export const SALES_CALL_TUTORS = ["Mankeerat", "Gurupma"] as const;

export const SALES_CALL_STATUSES = [
  "Need to Onboard",
  "Waiting",
  "In progress",
  "Refunded",
  "Onboarded",
] as const;
