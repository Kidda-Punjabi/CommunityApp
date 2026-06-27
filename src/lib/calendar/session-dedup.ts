import type { SupabaseClient } from "@supabase/supabase-js";
import { toLocalDateKeyFromDate } from "@/lib/calendar/month-calendar";
import type { SessionMatchResult } from "@/lib/calendar/match-events";
import type { GoogleCalendarEvent } from "@/lib/calendar/types";

function localDayBounds(iso: string): { start: string; end: string } {
  const date = new Date(iso);
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** When Google replaces a recurring instance (new id, same series + day), drop the old row. */
export async function removeReplacedRecurringInstance(
  adminClient: SupabaseClient,
  tutorId: string,
  event: GoogleCalendarEvent,
  match: SessionMatchResult
): Promise<void> {
  if (!event.recurringEventId) return;

  const { start, end } = localDayBounds(event.start);
  let query = adminClient
    .from("tutor_scheduled_sessions")
    .delete()
    .eq("tutor_id", tutorId)
    .eq("google_recurring_event_id", event.recurringEventId)
    .gte("starts_at", start)
    .lt("starts_at", end)
    .neq("google_event_id", event.id);

  if (match.studentId) {
    query = query.eq("student_id", match.studentId);
  } else if (match.cohortId) {
    query = query.eq("cohort_id", match.cohortId).is("student_id", null);
  } else {
    return;
  }

  const { error } = await query;
  if (error) throw error;
}

/** Same lesson moved within a day but Google issued a new event id (non-recurring). */
export async function removeSameDayLessonDuplicate(
  adminClient: SupabaseClient,
  tutorId: string,
  event: GoogleCalendarEvent,
  match: SessionMatchResult
): Promise<void> {
  if (event.recurringEventId) return;

  const { start, end } = localDayBounds(event.start);
  let query = adminClient
    .from("tutor_scheduled_sessions")
    .delete()
    .eq("tutor_id", tutorId)
    .eq("status", "scheduled")
    .gte("starts_at", start)
    .lt("starts_at", end)
    .neq("google_event_id", event.id);

  if (match.studentId) {
    query = query.eq("student_id", match.studentId);
  } else if (match.cohortId) {
    query = query.eq("cohort_id", match.cohortId).is("student_id", null);
  } else {
    return;
  }

  const { error } = await query;
  if (error) throw error;
}

export function localDayKey(iso: string): string {
  return toLocalDateKeyFromDate(new Date(iso));
}
