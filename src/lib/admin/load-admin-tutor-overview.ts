import type { AppRole } from "@/lib/auth/admin-access";
import { startOfWeekMonday } from "@/lib/calendar/time-grid-calendar";
import { getDisplayName } from "@/lib/profile/display-name";
import type { SupabaseClient } from "@supabase/supabase-js";

type ScheduledRangeRow = {
  tutor_id: string;
  starts_at: string;
  ends_at: string;
  google_event_id: string;
  google_recurring_event_id: string | null;
};

type ExclusionRow = {
  tutor_id: string;
  google_event_id: string | null;
  google_recurring_event_id: string | null;
};

export type AdminTutorOverviewRow = {
  tutorId: string;
  displayName: string;
  email: string | null;
  connected: boolean;
  lastSyncedAt: string | null;
  weeklyCapacityHours: number | null;
  usedHoursThisWeek: number;
  capacityPercent: number | null;
  studentCount: number;
  upcomingLessonCount: number;
  pendingRequestCount: number;
};

function toHours(startsAt: string, endsAt: string): number {
  const ms = new Date(endsAt).getTime() - new Date(startsAt).getTime();
  return Math.max(0, ms / (1000 * 60 * 60));
}

function isExcluded(session: ScheduledRangeRow, exclusions: ExclusionRow[]): boolean {
  return exclusions.some((row) => {
    if (row.google_event_id && row.google_event_id === session.google_event_id) return true;
    if (
      row.google_recurring_event_id &&
      session.google_recurring_event_id &&
      row.google_recurring_event_id === session.google_recurring_event_id
    ) {
      return true;
    }
    return false;
  });
}

export async function loadAdminTutorOverview(
  supabase: SupabaseClient
): Promise<{ tutors: AdminTutorOverviewRow[]; error?: string }> {
  const { data: roleRows, error: rolesError } = await supabase
    .from("profile_roles")
    .select("user_id, role");

  if (rolesError) return { tutors: [], error: rolesError.message };

  const rolesByUser = new Map<string, AppRole[]>();
  for (const row of roleRows ?? []) {
    const list = rolesByUser.get(row.user_id) ?? [];
    list.push(row.role as AppRole);
    rolesByUser.set(row.user_id, list);
  }

  // Tutor count should match Staff labels: only explicit tutor role.
  const tutorIds = [...rolesByUser.entries()]
    .filter(([, roles]) => roles.includes("tutor"))
    .map(([userId]) => userId);

  if (tutorIds.length === 0) return { tutors: [] };

  const nowIso = new Date().toISOString();
  const weekStart = startOfWeekMonday(new Date());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [
    { data: authData, error: authError },
    { data: profiles, error: profilesError },
    { data: availability },
    { data: connections },
    { data: enrollments },
    { data: upcomingSessions },
    { data: weeklySessions },
    { data: exclusions },
    { data: pendingRequests },
  ] = await Promise.all([
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabase.from("profiles").select("id, full_name, preferred_name").in("id", tutorIds),
    supabase
      .from("tutor_availability_settings")
      .select("tutor_id, weekly_capacity_hours")
      .in("tutor_id", tutorIds),
    supabase
      .from("tutor_google_calendar_connections")
      .select("tutor_id, last_synced_at")
      .in("tutor_id", tutorIds),
    supabase.from("course_enrollments").select("tutor_id, user_id").in("tutor_id", tutorIds),
    supabase
      .from("tutor_scheduled_sessions")
      .select("tutor_id")
      .in("tutor_id", tutorIds)
      .eq("status", "scheduled")
      .gte("starts_at", nowIso),
    supabase
      .from("tutor_scheduled_sessions")
      .select("tutor_id, starts_at, ends_at, google_event_id, google_recurring_event_id")
      .in("tutor_id", tutorIds)
      .eq("status", "scheduled")
      .gte("starts_at", weekStart.toISOString())
      .lt("starts_at", weekEnd.toISOString()),
    supabase
      .from("tutor_calendar_event_exclusions")
      .select("tutor_id, google_event_id, google_recurring_event_id")
      .in("tutor_id", tutorIds),
    supabase
      .from("lesson_reschedule_requests")
      .select("session_id, tutor_scheduled_sessions!inner(tutor_id)")
      .eq("status", "pending")
      .in("tutor_scheduled_sessions.tutor_id", tutorIds),
  ]);

  if (authError) return { tutors: [], error: authError.message };
  if (profilesError) return { tutors: [], error: profilesError.message };

  const emailById = new Map((authData?.users ?? []).map((user) => [user.id, user.email ?? null] as const));
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile] as const));
  const availabilityByTutor = new Map(
    (availability ?? []).map((row) => [row.tutor_id, Number(row.weekly_capacity_hours)] as const)
  );
  const connectionByTutor = new Map(
    (connections ?? []).map((row) => [row.tutor_id, row.last_synced_at ?? null] as const)
  );

  const studentIdsByTutor = new Map<string, Set<string>>();
  for (const row of enrollments ?? []) {
    const set = studentIdsByTutor.get(row.tutor_id) ?? new Set<string>();
    set.add(row.user_id);
    studentIdsByTutor.set(row.tutor_id, set);
  }

  const upcomingCountByTutor = new Map<string, number>();
  for (const row of upcomingSessions ?? []) {
    upcomingCountByTutor.set(row.tutor_id, (upcomingCountByTutor.get(row.tutor_id) ?? 0) + 1);
  }

  const exclusionsByTutor = new Map<string, ExclusionRow[]>();
  for (const row of (exclusions ?? []) as ExclusionRow[]) {
    const list = exclusionsByTutor.get(row.tutor_id) ?? [];
    list.push(row);
    exclusionsByTutor.set(row.tutor_id, list);
  }

  const usedHoursByTutor = new Map<string, number>();
  for (const row of (weeklySessions ?? []) as ScheduledRangeRow[]) {
    const excluded = isExcluded(row, exclusionsByTutor.get(row.tutor_id) ?? []);
    if (excluded) continue;
    usedHoursByTutor.set(row.tutor_id, (usedHoursByTutor.get(row.tutor_id) ?? 0) + toHours(row.starts_at, row.ends_at));
  }

  const pendingByTutor = new Map<string, number>();
  for (const row of pendingRequests ?? []) {
    const relation = (
      row as { tutor_scheduled_sessions: { tutor_id: string } | Array<{ tutor_id: string }> }
    ).tutor_scheduled_sessions;
    const tutorId = Array.isArray(relation) ? relation[0]?.tutor_id : relation?.tutor_id;
    if (!tutorId) continue;
    pendingByTutor.set(tutorId, (pendingByTutor.get(tutorId) ?? 0) + 1);
  }

  const tutors: AdminTutorOverviewRow[] = tutorIds
    .map((tutorId) => {
      const profile = profileById.get(tutorId) ?? null;
      const displayName = (profile ? getDisplayName(profile) : null) ?? emailById.get(tutorId) ?? "Tutor";
      const capacity = availabilityByTutor.get(tutorId);
      const used = Math.round((usedHoursByTutor.get(tutorId) ?? 0) * 10) / 10;
      const percent =
        capacity && capacity > 0 ? Math.min(100, Math.round((used / capacity) * 100)) : null;

      return {
        tutorId,
        displayName,
        email: emailById.get(tutorId) ?? null,
        connected: connectionByTutor.has(tutorId),
        lastSyncedAt: connectionByTutor.get(tutorId) ?? null,
        weeklyCapacityHours: capacity ?? null,
        usedHoursThisWeek: used,
        capacityPercent: percent,
        studentCount: studentIdsByTutor.get(tutorId)?.size ?? 0,
        upcomingLessonCount: upcomingCountByTutor.get(tutorId) ?? 0,
        pendingRequestCount: pendingByTutor.get(tutorId) ?? 0,
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  return { tutors };
}
