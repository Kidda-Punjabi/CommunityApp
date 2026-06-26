import { LESSON_EVENT_TITLE_TAG } from "@/lib/calendar/constants";
import type { SessionMatchResult } from "@/lib/calendar/match-events";
import type { GoogleCalendarEvent } from "@/lib/calendar/types";

export function shouldImportLessonEvent(
  event: GoogleCalendarEvent,
  match: SessionMatchResult
): boolean {
  if (match.matchMethod === "unmatched") return false;

  if (LESSON_EVENT_TITLE_TAG && !event.summary.includes(LESSON_EVENT_TITLE_TAG)) {
    return false;
  }

  return true;
}

export function lessonImportSkipReason(
  event: GoogleCalendarEvent,
  match: SessionMatchResult
): "unmatched" | "missing_title_tag" | null {
  if (match.matchMethod === "unmatched") return "unmatched";
  if (LESSON_EVENT_TITLE_TAG && !event.summary.includes(LESSON_EVENT_TITLE_TAG)) {
    return "missing_title_tag";
  }
  return null;
}
