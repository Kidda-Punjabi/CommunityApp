import type { GoogleCalendarEvent } from "@/lib/calendar/types";

export type CalendarExclusionRow = {
  google_event_id: string | null;
  google_recurring_event_id: string | null;
  scope: "event" | "series";
};

export function isCalendarEventExcluded(
  event: Pick<GoogleCalendarEvent, "id" | "recurringEventId">,
  exclusions: CalendarExclusionRow[]
): boolean {
  for (const exclusion of exclusions) {
    if (
      exclusion.scope === "series" &&
      exclusion.google_recurring_event_id &&
      event.recurringEventId === exclusion.google_recurring_event_id
    ) {
      return true;
    }

    if (exclusion.google_event_id && event.id === exclusion.google_event_id) {
      return true;
    }
  }

  return false;
}
