export const RESCHEDULE_CUTOFF_MS = 24 * 60 * 60 * 1000;

/** Group lessons: alternate cohort requests must be at least 3 days before the session. */
export const COHORT_SWITCH_CUTOFF_MS = 3 * 24 * 60 * 60 * 1000;

export const GOOGLE_CALENDAR_SCOPES = [
  /** Read/write events (required for adding cohort students as attendees). Tutors must reconnect after this scope change. */
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
] as const;

/** Admin tutor overview: cap upcoming lesson counts to a plausible window. */
export const ADMIN_UPCOMING_LESSONS_WINDOW_DAYS = 56;

const parsedLookahead = Number(process.env.GOOGLE_CALENDAR_SYNC_LOOKAHEAD_DAYS ?? 540);
const parsedLookback = Number(process.env.GOOGLE_CALENDAR_SYNC_LOOKBACK_DAYS ?? 90);

/** How far ahead to pull events from Google Calendar on a full sync (default 18 months). */
export const CALENDAR_SYNC_LOOKAHEAD_DAYS =
  Number.isFinite(parsedLookahead) && parsedLookahead > 0 ? parsedLookahead : 540;

/** How far back to pull events on a full sync (default 90 days). */
export const CALENDAR_SYNC_LOOKBACK_DAYS =
  Number.isFinite(parsedLookback) && parsedLookback > 0 ? parsedLookback : 90;

export function calendarSyncRangeStart(fromMs = Date.now()): string {
  return new Date(fromMs - CALENDAR_SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function calendarSyncRangeEnd(fromMs = Date.now()): string {
  return new Date(fromMs + CALENDAR_SYNC_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** When set, only calendar events whose title contains this tag are imported (after student match). */
export const LESSON_EVENT_TITLE_TAG =
  process.env.GOOGLE_CALENDAR_LESSON_TITLE_TAG?.trim() || null;
