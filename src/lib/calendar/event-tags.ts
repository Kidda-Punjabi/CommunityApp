import type { GoogleCalendarEvent, ScheduledSessionRow } from "@/lib/calendar/types";

export const KIDDA_WORK_CATEGORIES = ["kidda_meeting", "kidda_admin", "kidda_prep"] as const;
export type KiddaWorkCategory = (typeof KIDDA_WORK_CATEGORIES)[number];

export const LESSON_MATCH_METHODS = ["attendee_email", "title_name", "manual"] as const;
export type LessonMatchMethod = (typeof LESSON_MATCH_METHODS)[number];

export type CalendarEventTagRow = {
  google_event_id: string | null;
  google_recurring_event_id: string | null;
  scope: "event" | "series";
  category: KiddaWorkCategory;
};

export const KIDDA_WORK_CATEGORY_LABELS: Record<KiddaWorkCategory, string> = {
  kidda_meeting: "Kidda meeting",
  kidda_admin: "Kidda admin",
  kidda_prep: "Kidda prep",
};

export function isLessonMatchMethod(
  matchMethod: ScheduledSessionRow["match_method"]
): matchMethod is LessonMatchMethod {
  return (
    matchMethod === "attendee_email" ||
    matchMethod === "title_name" ||
    matchMethod === "manual"
  );
}

export function findCalendarEventTag(
  event: Pick<GoogleCalendarEvent, "id" | "recurringEventId">,
  tags: CalendarEventTagRow[]
): CalendarEventTagRow | null {
  for (const tag of tags) {
    if (
      tag.scope === "series" &&
      tag.google_recurring_event_id &&
      event.recurringEventId === tag.google_recurring_event_id
    ) {
      return tag;
    }

    if (tag.google_event_id && event.id === tag.google_event_id) {
      return tag;
    }
  }

  return null;
}

export function findStoredSessionTag(
  session: Pick<ScheduledSessionRow, "google_event_id" | "google_recurring_event_id">,
  tags: CalendarEventTagRow[]
): CalendarEventTagRow | null {
  return findCalendarEventTag(
    {
      id: session.google_event_id,
      recurringEventId: session.google_recurring_event_id,
    },
    tags
  );
}
