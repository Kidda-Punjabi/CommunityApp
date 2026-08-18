import { addDays, startOfWeekMonday } from "@/lib/calendar/time-grid-calendar";
import { isStoredSessionExcluded, type CalendarExclusionRow } from "@/lib/calendar/exclusions";
import { findStoredSessionTag, type CalendarEventTagRow } from "@/lib/calendar/event-tags";
import { loadTutorMatchCandidates } from "@/lib/calendar/load-match-candidates";
import { getDisplayName } from "@/lib/profile/display-name";
import {
  formatWeekStartParam,
  loadTutorHoursTutorIds,
  parseWeekStartParam,
} from "@/lib/admin/load-admin-tutor-hours";
import {
  suggestCalendarCategory,
  type ReviewCategory,
} from "@/lib/admin/suggest-calendar-category";
import type { ScheduledSessionRow } from "@/lib/calendar/types";
import type { KiddaWorkCategory } from "@/lib/calendar/event-tags";
import type { SupabaseClient } from "@supabase/supabase-js";

export type TutorHoursReviewEvent = {
  sessionId: string;
  tutorId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  googleEventId: string;
  googleRecurringEventId: string | null;
  occurrenceCount: number;
  suggested: ReviewCategory;
  suggestionReason: string;
};

export type TutorHoursTaggedEvent = {
  tutorId: string;
  title: string | null;
  category: KiddaWorkCategory;
  scope: "event" | "series";
  taggedById: string;
  taggedByName: string;
  createdAt: string;
};

export type TutorHoursReviewTutor = {
  tutorId: string;
  displayName: string;
  email: string | null;
  pending: TutorHoursReviewEvent[];
  alreadyTagged: TutorHoursTaggedEvent[];
};

export type TutorHoursReviewResult = {
  weekStart: string;
  tutors: TutorHoursReviewTutor[];
  error?: string;
};

type SessionRow = Pick<
  ScheduledSessionRow,
  | "id"
  | "tutor_id"
  | "title"
  | "starts_at"
  | "ends_at"
  | "google_event_id"
  | "google_recurring_event_id"
  | "match_method"
  | "status"
>;

export async function loadAdminTutorHoursReview(
  supabase: SupabaseClient,
  weekStartInput?: string | null
): Promise<TutorHoursReviewResult> {
  const weekStart = parseWeekStartParam(weekStartInput);
  const currentWeekStart = startOfWeekMonday(new Date());
  if (weekStart.getTime() < currentWeekStart.getTime()) {
    return { weekStart: formatWeekStartParam(weekStart), tutors: [] };
  }

  const weekEnd = addDays(weekStart, 7);
  const { tutorIds, emailById, error } = await loadTutorHoursTutorIds(supabase);
  if (error) return { weekStart: formatWeekStartParam(weekStart), tutors: [], error };
  if (tutorIds.length === 0) return { weekStart: formatWeekStartParam(weekStart), tutors: [] };

  const [{ data: profiles, error: profilesError }, { data: sessions, error: sessionsError }, { data: exclusions }, { data: tags }] =
    await Promise.all([
      supabase.from("profiles").select("id, full_name, preferred_name").in("id", tutorIds),
      supabase
        .from("tutor_scheduled_sessions")
        .select(
          "id, tutor_id, title, starts_at, ends_at, google_event_id, google_recurring_event_id, match_method, status"
        )
        .in("tutor_id", tutorIds)
        .eq("status", "scheduled")
        .eq("match_method", "unmatched")
        .gte("starts_at", weekStart.toISOString())
        .lt("starts_at", weekEnd.toISOString())
        .order("starts_at", { ascending: true }),
      supabase
        .from("tutor_calendar_event_exclusions")
        .select("tutor_id, google_event_id, google_recurring_event_id, scope")
        .in("tutor_id", tutorIds),
      supabase
        .from("tutor_calendar_event_tags")
        .select(
          "tutor_id, google_event_id, google_recurring_event_id, scope, category, title, tagged_by, created_at"
        )
        .in("tutor_id", tutorIds),
    ]);

  if (profilesError) {
    return { weekStart: formatWeekStartParam(weekStart), tutors: [], error: profilesError.message };
  }
  if (sessionsError) {
    return { weekStart: formatWeekStartParam(weekStart), tutors: [], error: sessionsError.message };
  }

  const exclusionsByTutor = new Map<string, CalendarExclusionRow[]>();
  for (const row of (exclusions ?? []) as Array<CalendarExclusionRow & { tutor_id: string }>) {
    const list = exclusionsByTutor.get(row.tutor_id) ?? [];
    list.push({
      google_event_id: row.google_event_id,
      google_recurring_event_id: row.google_recurring_event_id,
      scope: row.scope,
    });
    exclusionsByTutor.set(row.tutor_id, list);
  }

  const tagsByTutor = new Map<string, CalendarEventTagRow[]>();
  const taggedRows = (tags ?? []) as Array<
    CalendarEventTagRow & {
      tutor_id: string;
      title: string | null;
      tagged_by: string;
      created_at: string;
    }
  >;
  for (const row of taggedRows) {
    const list = tagsByTutor.get(row.tutor_id) ?? [];
    list.push({
      google_event_id: row.google_event_id,
      google_recurring_event_id: row.google_recurring_event_id,
      scope: row.scope,
      category: row.category,
    });
    tagsByTutor.set(row.tutor_id, list);
  }

  const taggedByIds = [...new Set(taggedRows.map((row) => row.tagged_by))];
  const { data: taggedByProfiles } =
    taggedByIds.length > 0
      ? await supabase.from("profiles").select("id, full_name, preferred_name").in("id", taggedByIds)
      : { data: [] };
  const taggedByName = new Map(
    (taggedByProfiles ?? []).map((profile) => [
      profile.id,
      getDisplayName(profile) ?? emailById.get(profile.id) ?? "Someone",
    ])
  );

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile] as const));
  const candidatesByTutor = new Map<
    string,
    Awaited<ReturnType<typeof loadTutorMatchCandidates>>
  >();
  await Promise.all(
    tutorIds.map(async (tutorId) => {
      candidatesByTutor.set(tutorId, await loadTutorMatchCandidates(supabase, tutorId));
    })
  );

  const pendingByTutor = new Map<string, Map<string, TutorHoursReviewEvent>>();
  for (const row of (sessions ?? []) as SessionRow[]) {
    const excluded = isStoredSessionExcluded(row, exclusionsByTutor.get(row.tutor_id) ?? []);
    const tagged = findStoredSessionTag(row, tagsByTutor.get(row.tutor_id) ?? []);
    if (excluded || tagged) continue;

    const groupKey = row.google_recurring_event_id
      ? `series:${row.google_recurring_event_id}`
      : `event:${row.google_event_id}`;
    const tutorMap = pendingByTutor.get(row.tutor_id) ?? new Map<string, TutorHoursReviewEvent>();
    const existing = tutorMap.get(groupKey);
    if (existing) {
      existing.occurrenceCount += 1;
      continue;
    }

    const candidates = candidatesByTutor.get(row.tutor_id) ?? { students: [], cohorts: [] };
    const suggestion = suggestCalendarCategory(row.title, {
      students: candidates.students,
      cohorts: candidates.cohorts,
      isRecurring: Boolean(row.google_recurring_event_id),
    });

    tutorMap.set(groupKey, {
      sessionId: row.id,
      tutorId: row.tutor_id,
      title: row.title,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      googleEventId: row.google_event_id,
      googleRecurringEventId: row.google_recurring_event_id,
      occurrenceCount: 1,
      suggested: suggestion.category,
      suggestionReason: suggestion.reason,
    });
    pendingByTutor.set(row.tutor_id, tutorMap);
  }

  const tutors: TutorHoursReviewTutor[] = tutorIds
    .map((tutorId) => {
      const profile = profileById.get(tutorId) ?? null;
      const email = emailById.get(tutorId) ?? null;
      return {
        tutorId,
        displayName: (profile ? getDisplayName(profile) : null) ?? email ?? "Tutor",
        email,
        pending: [...(pendingByTutor.get(tutorId)?.values() ?? [])].sort((a, b) =>
          a.startsAt.localeCompare(b.startsAt)
        ),
        alreadyTagged: taggedRows
          .filter((row) => row.tutor_id === tutorId)
          .map((row) => ({
            tutorId,
            title: row.title,
            category: row.category,
            scope: row.scope,
            taggedById: row.tagged_by,
            taggedByName:
              taggedByName.get(row.tagged_by) ??
              (row.tagged_by === tutorId ? "this tutor" : "Admin"),
            createdAt: row.created_at,
          }))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  return { weekStart: formatWeekStartParam(weekStart), tutors };
}
