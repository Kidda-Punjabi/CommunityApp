export const RESCHEDULE_CUTOFF_MS = 24 * 60 * 60 * 1000;

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
] as const;

export const CALENDAR_SYNC_LOOKAHEAD_DAYS = 60;

/** When set, only calendar events whose title contains this tag are imported (after student match). */
export const LESSON_EVENT_TITLE_TAG =
  process.env.GOOGLE_CALENDAR_LESSON_TITLE_TAG?.trim() || null;
