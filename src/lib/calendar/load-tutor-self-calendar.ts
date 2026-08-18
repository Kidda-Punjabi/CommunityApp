import { isCalendarEventExcluded } from "@/lib/calendar/exclusions";
import type { CalendarExclusionRow } from "@/lib/calendar/exclusions";
import {
  findCalendarEventTag,
  type CalendarEventTagRow,
  type KiddaWorkCategory,
} from "@/lib/calendar/event-tags";
import { calendarSyncRangeStart } from "@/lib/calendar/constants";
import type { ScheduledSessionRow } from "@/lib/calendar/types";
import { getDisplayName } from "@/lib/profile/display-name";
import type { SupabaseClient } from "@supabase/supabase-js";

export type TutorSelfCalendarSession = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  meet_link: string | null;
  studentName: string | null;
  cohortName: string | null;
  matchMethod: ScheduledSessionRow["match_method"];
  googleEventId: string;
  googleRecurringEventId: string | null;
  excludedByTutor: boolean;
  kiddaTag: KiddaWorkCategory | null;
  kiddaTagScope: "event" | "series" | null;
  pendingRescheduleCount: number;
};

export async function loadTutorSelfCalendarSessions(
  supabase: SupabaseClient,
  tutorId: string
): Promise<{ sessions: TutorSelfCalendarSession[]; schemaReady: boolean }> {
  const rangeStart = calendarSyncRangeStart();

  const [{ data: sessions, error }, { data: exclusions }, tagsResult] = await Promise.all([
    supabase
      .from("tutor_scheduled_sessions")
      .select("*")
      .eq("tutor_id", tutorId)
      .eq("status", "scheduled")
      .gte("starts_at", rangeStart)
      .order("starts_at", { ascending: true })
      .limit(500),
    supabase
      .from("tutor_calendar_event_exclusions")
      .select("google_event_id, google_recurring_event_id, scope")
      .eq("tutor_id", tutorId),
    supabase
      .from("tutor_calendar_event_tags")
      .select("google_event_id, google_recurring_event_id, scope, category")
      .eq("tutor_id", tutorId),
  ]);

  if (error) {
    if (error.message?.includes("tutor_scheduled_sessions")) {
      return { sessions: [], schemaReady: false };
    }
    throw error;
  }

  const exclusionRows = (exclusions ?? []) as CalendarExclusionRow[];
  const tagRows = (
    tagsResult.error?.code === "PGRST205" ||
    tagsResult.error?.message?.includes("tutor_calendar_event_tags")
      ? []
      : (tagsResult.data ?? [])
  ) as CalendarEventTagRow[];
  const rows = (sessions ?? []) as ScheduledSessionRow[];

  const studentIds = [...new Set(rows.map((r) => r.student_id).filter(Boolean))] as string[];
  const cohortIds = [...new Set(rows.map((r) => r.cohort_id).filter(Boolean))] as string[];

  const [{ data: students }, { data: cohorts }, { data: pendingRows }] = await Promise.all([
    studentIds.length
      ? supabase.from("profiles").select("id, full_name, preferred_name").in("id", studentIds)
      : Promise.resolve({ data: [] }),
    cohortIds.length
      ? supabase.from("cohorts").select("id, name").in("id", cohortIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("lesson_reschedule_requests")
      .select("session_id, tutor_scheduled_sessions!inner(tutor_id)")
      .eq("status", "pending")
      .eq("tutor_scheduled_sessions.tutor_id", tutorId),
  ]);

  const studentNameById = new Map(
    (students ?? []).map((s) => [s.id, getDisplayName(s) ?? "Student"])
  );
  const cohortNameById = new Map((cohorts ?? []).map((c) => [c.id, c.name]));

  const pendingCountBySession = new Map<string, number>();
  for (const request of pendingRows ?? []) {
    pendingCountBySession.set(
      request.session_id,
      (pendingCountBySession.get(request.session_id) ?? 0) + 1
    );
  }

  return {
    schemaReady: true,
    sessions: rows.map((session) => {
      const eventRef = {
        id: session.google_event_id,
        recurringEventId: session.google_recurring_event_id,
      };
      const tag = findCalendarEventTag(eventRef, tagRows);
      return {
        id: session.id,
        title: session.title,
        starts_at: session.starts_at,
        ends_at: session.ends_at,
        meet_link: session.meet_link,
        studentName: session.student_id ? (studentNameById.get(session.student_id) ?? null) : null,
        cohortName: session.cohort_id ? (cohortNameById.get(session.cohort_id) ?? null) : null,
        matchMethod: session.match_method,
        googleEventId: session.google_event_id,
        googleRecurringEventId: session.google_recurring_event_id,
        excludedByTutor: isCalendarEventExcluded(eventRef, exclusionRows),
        kiddaTag: tag?.category ?? null,
        kiddaTagScope: tag?.scope ?? null,
        pendingRescheduleCount: pendingCountBySession.get(session.id) ?? 0,
      };
    }),
  };
}
