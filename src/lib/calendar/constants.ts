export const RESCHEDULE_CUTOFF_MS = 24 * 60 * 60 * 1000;

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
] as const;

export const CALENDAR_SYNC_LOOKAHEAD_DAYS = 60;
