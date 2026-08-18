import { addDays, startOfWeekMonday } from "@/lib/calendar/time-grid-calendar";
import {
  findStoredSessionTag,
  isLessonMatchMethod,
  type CalendarEventTagRow,
} from "@/lib/calendar/event-tags";
import { getDisplayName } from "@/lib/profile/display-name";
import type { ScheduledSessionRow } from "@/lib/calendar/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Only the hello@ account is excluded — tutors who also hold master_admin stay in the list. */
const EXCLUDED_TUTOR_HOURS_EMAILS = new Set(["hello@kidda.app"]);

export async function loadTutorHoursTutorIds(supabase: SupabaseClient): Promise<{
  tutorIds: string[];
  emailById: Map<string, string | null>;
  error?: string;
}> {
  const { data: roleRows, error: rolesError } = await supabase
    .from("profile_roles")
    .select("user_id, role")
    .eq("role", "tutor");

  if (rolesError) return { tutorIds: [], emailById: new Map(), error: rolesError.message };

  const tutorIds = [...new Set((roleRows ?? []).map((row) => row.user_id))];
  if (tutorIds.length === 0) return { tutorIds: [], emailById: new Map() };

  const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (authError) return { tutorIds: [], emailById: new Map(), error: authError.message };

  const emailById = new Map(
    (authData?.users ?? []).map((user) => [user.id, user.email?.toLowerCase() ?? null] as const)
  );

  return {
    tutorIds: tutorIds.filter((tutorId) => {
      const email = emailById.get(tutorId);
      return !email || !EXCLUDED_TUTOR_HOURS_EMAILS.has(email);
    }),
    emailById,
  };
}

export type TutorHoursWeekRow = {
  tutorId: string;
  displayName: string;
  email: string | null;
  lessonHours: number;
  meetingAdminHours: number;
  totalHours: number;
};

export type TutorHoursWeekResult = {
  weekStart: string;
  weekEnd: string;
  isPastWeek: boolean;
  historicalNote: string | null;
  tutors: TutorHoursWeekRow[];
  error?: string;
};

type SessionRow = {
  tutor_id: string;
  starts_at: string;
  ends_at: string;
  google_event_id: string;
  google_recurring_event_id: string | null;
  match_method: ScheduledSessionRow["match_method"];
  status: string;
};

function toHours(startsAt: string, endsAt: string): number {
  const ms = new Date(endsAt).getTime() - new Date(startsAt).getTime();
  return Math.max(0, ms / (1000 * 60 * 60));
}

function roundHours(value: number): number {
  return Math.round(value * 10) / 10;
}

export function parseWeekStartParam(value: string | null | undefined): Date {
  if (value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (match) {
      const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      if (!Number.isNaN(parsed.getTime())) {
        return startOfWeekMonday(parsed);
      }
    }
  }
  return startOfWeekMonday(new Date());
}

export function formatWeekStartParam(weekStart: Date): string {
  const year = weekStart.getFullYear();
  const month = String(weekStart.getMonth() + 1).padStart(2, "0");
  const day = String(weekStart.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatWeekRangeLabel(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const startLabel = weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const endLabel = weekEnd.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

export async function loadAdminTutorHours(
  supabase: SupabaseClient,
  weekStartInput?: string | null
): Promise<TutorHoursWeekResult> {
  const weekStart = parseWeekStartParam(weekStartInput);
  const weekEnd = addDays(weekStart, 7);
  const currentWeekStart = startOfWeekMonday(new Date());
  const isPastWeek = weekStart.getTime() < currentWeekStart.getTime();
  const weekStartIso = weekStart.toISOString();
  const weekEndIso = weekEnd.toISOString();

  const { tutorIds, emailById, error: tutorIdsError } = await loadTutorHoursTutorIds(supabase);
  if (tutorIdsError) {
    return {
      weekStart: formatWeekStartParam(weekStart),
      weekEnd: formatWeekStartParam(addDays(weekStart, 6)),
      isPastWeek,
      historicalNote: null,
      tutors: [],
      error: tutorIdsError,
    };
  }

  if (tutorIds.length === 0) {
    return {
      weekStart: formatWeekStartParam(weekStart),
      weekEnd: formatWeekStartParam(addDays(weekStart, 6)),
      isPastWeek,
      historicalNote: isPastWeek
        ? "Historical weeks are not available. Tutor hours are going-forward only from when tagging shipped."
        : null,
      tutors: [],
    };
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, preferred_name")
    .in("id", tutorIds);

  if (profilesError) {
    return emptyResult(weekStart, isPastWeek, profilesError.message);
  }

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile] as const));

  const tutorsBase = tutorIds
    .map((tutorId) => {
      const profile = profileById.get(tutorId) ?? null;
      const email = emailById.get(tutorId) ?? null;
      return {
        tutorId,
        displayName: (profile ? getDisplayName(profile) : null) ?? email ?? "Tutor",
        email,
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  if (isPastWeek) {
    return {
      weekStart: formatWeekStartParam(weekStart),
      weekEnd: formatWeekStartParam(addDays(weekStart, 6)),
      isPastWeek: true,
      historicalNote:
        "Historical weeks are not available. Tutor hours are going-forward only from when event tagging shipped — past unmatched events were never tagged.",
      tutors: tutorsBase.map((tutor) => ({
        ...tutor,
        lessonHours: 0,
        meetingAdminHours: 0,
        totalHours: 0,
      })),
    };
  }

  const [{ data: sessions, error: sessionsError }, { data: tags, error: tagsError }] =
    await Promise.all([
      supabase
        .from("tutor_scheduled_sessions")
        .select(
          "tutor_id, starts_at, ends_at, google_event_id, google_recurring_event_id, match_method, status"
        )
        .in("tutor_id", tutorIds)
        .eq("status", "scheduled")
        .gte("starts_at", weekStartIso)
        .lt("starts_at", weekEndIso),
      supabase
        .from("tutor_calendar_event_tags")
        .select("tutor_id, google_event_id, google_recurring_event_id, scope, category")
        .in("tutor_id", tutorIds),
    ]);

  if (sessionsError) {
    return emptyResult(weekStart, false, sessionsError.message);
  }
  if (tagsError) {
    return emptyResult(
      weekStart,
      false,
      tagsError.message?.includes("tutor_calendar_event_tags")
        ? "Calendar event tags are not set up yet. Run supabase/tutor-calendar-event-tags.sql."
        : tagsError.message
    );
  }

  const tagsByTutor = new Map<string, CalendarEventTagRow[]>();
  for (const row of (tags ?? []) as Array<CalendarEventTagRow & { tutor_id: string }>) {
    const list = tagsByTutor.get(row.tutor_id) ?? [];
    list.push({
      google_event_id: row.google_event_id,
      google_recurring_event_id: row.google_recurring_event_id,
      scope: row.scope,
      category: row.category,
    });
    tagsByTutor.set(row.tutor_id, list);
  }

  const lessonHoursByTutor = new Map<string, number>();
  const meetingHoursByTutor = new Map<string, number>();

  for (const row of (sessions ?? []) as SessionRow[]) {
    const hours = toHours(row.starts_at, row.ends_at);
    if (isLessonMatchMethod(row.match_method)) {
      lessonHoursByTutor.set(row.tutor_id, (lessonHoursByTutor.get(row.tutor_id) ?? 0) + hours);
      continue;
    }

    const tag = findStoredSessionTag(row, tagsByTutor.get(row.tutor_id) ?? []);
    if (!tag) continue;
    meetingHoursByTutor.set(row.tutor_id, (meetingHoursByTutor.get(row.tutor_id) ?? 0) + hours);
  }

  return {
    weekStart: formatWeekStartParam(weekStart),
    weekEnd: formatWeekStartParam(addDays(weekStart, 6)),
    isPastWeek: false,
    historicalNote: null,
    tutors: tutorsBase.map((tutor) => {
      const lessonHours = roundHours(lessonHoursByTutor.get(tutor.tutorId) ?? 0);
      const meetingAdminHours = roundHours(meetingHoursByTutor.get(tutor.tutorId) ?? 0);
      return {
        ...tutor,
        lessonHours,
        meetingAdminHours,
        totalHours: roundHours(lessonHours + meetingAdminHours),
      };
    }),
  };
}

function emptyResult(
  weekStart: Date,
  isPastWeek: boolean,
  error: string
): TutorHoursWeekResult {
  return {
    weekStart: formatWeekStartParam(weekStart),
    weekEnd: formatWeekStartParam(addDays(weekStart, 6)),
    isPastWeek,
    historicalNote: isPastWeek
      ? "Historical weeks are not available. Tutor hours are going-forward only from when tagging shipped."
      : null,
    tutors: [],
    error,
  };
}
