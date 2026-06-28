export const RESCHEDULE_CUTOFF_MS = 24 * 60 * 60 * 1000;

/** Group lessons: alternate cohort requests must be at least 3 days before the session. */
export const COHORT_SWITCH_CUTOFF_MS = 3 * 24 * 60 * 60 * 1000;

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
] as const;

const parsedLookahead = Number(process.env.GOOGLE_CALENDAR_SYNC_LOOKAHEAD_DAYS ?? 540);

/** How far ahead to pull events from Google Calendar on a full sync (default 18 months). */
export const CALENDAR_SYNC_LOOKAHEAD_DAYS =
  Number.isFinite(parsedLookahead) && parsedLookahead > 0 ? parsedLookahead : 540;

/** When set, only calendar events whose title contains this tag are imported (after student match). */
export const LESSON_EVENT_TITLE_TAG =
  process.env.GOOGLE_CALENDAR_LESSON_TITLE_TAG?.trim() || null;
