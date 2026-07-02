import type { AppRole } from "@/lib/auth/admin-access";
import { ASSIGNABLE_STAFF_ROLES } from "@/lib/auth/admin-access";
import { hasAnyRole } from "@/lib/auth/profile-roles";
import type { CalendarExclusionRow } from "@/lib/calendar/exclusions";
import { isCalendarEventExcluded } from "@/lib/calendar/exclusions";
import type { ScheduledSessionRow } from "@/lib/calendar/types";
import { calendarSyncRangeStart } from "@/lib/calendar/constants";
import { getDisplayName } from "@/lib/profile/display-name";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AttendeeAccountStatus = {
  email: string;
  hasAccount: boolean;
  displayName: string | null;
  userId: string | null;
};

export type AdminTutorCalendarRow = {
  tutorId: string;
  displayName: string;
  email: string | null;
  appRoles: AppRole[];
  connected: boolean;
  googleAccountEmail: string | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  upcomingLessonCount: number;
  loadedEventCount: number;
};

export type AdminTutorCalendarSession = {
  id: string;
  tutorId: string;
  tutorName: string;
  title: string;
  starts_at: string;
  ends_at: string;
  meet_link: string | null;
  studentName: string | null;
  cohortName: string | null;
  matchMethod: ScheduledSessionRow["match_method"];
  excludedByTutor: boolean;
  attendeeEmails: string[];
  attendees: AttendeeAccountStatus[];
};

export type AdminTutorCalendarsData = {
  tutors: AdminTutorCalendarRow[];
  sessions: AdminTutorCalendarSession[];
  schemaReady: boolean;
  error?: string;
};

function adminCalendarRangeStart(): string {
  return calendarSyncRangeStart();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function fetchAdminSessions(
  supabase: SupabaseClient,
  tutorIds: string[]
): Promise<ScheduledSessionRow[]> {
  const rangeStart = adminCalendarRangeStart();
  const rows: ScheduledSessionRow[] = [];

  for (const tutorId of tutorIds) {
    const { data, error } = await supabase
      .from("tutor_scheduled_sessions")
      .select("*")
      .eq("tutor_id", tutorId)
      .eq("status", "scheduled")
      .gte("starts_at", rangeStart)
      .order("starts_at", { ascending: true })
      .limit(10000);

    if (error) throw error;
    if (data) rows.push(...(data as ScheduledSessionRow[]));
  }

  return rows.sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );
}

function buildAccountLookup(
  authUsers: Array<{ id: string; email?: string | null }>,
  profiles: Array<{ id: string; full_name: string | null; preferred_name: string | null }>
) {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const userIdByEmail = new Map<string, string>();

  for (const user of authUsers) {
    if (!user.email) continue;
    userIdByEmail.set(normalizeEmail(user.email), user.id);
  }

  return { profileById, userIdByEmail };
}

function resolveAttendees(
  attendeeEmails: string[],
  tutorEmails: Set<string>,
  userIdByEmail: Map<string, string>,
  profileById: Map<string, { full_name: string | null; preferred_name: string | null }>
): AttendeeAccountStatus[] {
  const seen = new Set<string>();
  const attendees: AttendeeAccountStatus[] = [];

  for (const rawEmail of attendeeEmails) {
    const email = normalizeEmail(rawEmail);
    if (!email || seen.has(email) || tutorEmails.has(email)) continue;
    seen.add(email);

    const userId = userIdByEmail.get(email) ?? null;
    const profile = userId ? profileById.get(userId) : null;

    attendees.push({
      email: rawEmail.trim(),
      hasAccount: Boolean(userId),
      userId,
      displayName: profile ? getDisplayName(profile) : null,
    });
  }

  return attendees;
}

function isSessionExcluded(
  session: Pick<ScheduledSessionRow, "google_event_id" | "google_recurring_event_id">,
  exclusions: CalendarExclusionRow[]
): boolean {
  return isCalendarEventExcluded(
    {
      id: session.google_event_id,
      recurringEventId: session.google_recurring_event_id,
    },
    exclusions
  );
}

export async function loadAdminTutorCalendars(
  supabase: SupabaseClient
): Promise<AdminTutorCalendarsData> {
  const [
    { data: roleRows, error: rolesError },
    { data: connectionRows, error: connectionsListError },
  ] = await Promise.all([
    supabase.from("profile_roles").select("user_id, role"),
    supabase.from("tutor_google_calendar_connections").select("tutor_id"),
  ]);

  if (rolesError) {
    return { tutors: [], sessions: [], schemaReady: true, error: rolesError.message };
  }
  if (connectionsListError?.message?.includes("tutor_google_calendar_connections")) {
    return { tutors: [], sessions: [], schemaReady: false };
  }

  const rolesByUser = new Map<string, AppRole[]>();
  for (const row of roleRows ?? []) {
    const list = rolesByUser.get(row.user_id) ?? [];
    list.push(row.role as AppRole);
    rolesByUser.set(row.user_id, list);
  }

  const staffTutorIds = [...rolesByUser.entries()]
    .filter(([, roles]) => hasAnyRole(roles, [...ASSIGNABLE_STAFF_ROLES]))
    .map(([userId]) => userId);

  const connectedTutorIds = (connectionRows ?? []).map((row) => row.tutor_id);
  const tutorUserIds = [...new Set([...staffTutorIds, ...connectedTutorIds])];

  if (tutorUserIds.length === 0) {
    return { tutors: [], sessions: [], schemaReady: true };
  }

  const [
    { data: profiles, error: profilesError },
    { data: allProfiles, error: allProfilesError },
    { data: authData, error: authError },
    { data: connections, error: connectionsError },
    { data: exclusionRows, error: exclusionsError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, preferred_name")
      .in("id", tutorUserIds),
    supabase.from("profiles").select("id, full_name, preferred_name"),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabase
      .from("tutor_google_calendar_connections")
      .select("tutor_id, google_account_email, connected_at, last_synced_at")
      .in("tutor_id", tutorUserIds),
    supabase
      .from("tutor_calendar_event_exclusions")
      .select("tutor_id, google_event_id, google_recurring_event_id, scope")
      .in("tutor_id", tutorUserIds),
  ]);

  let sessionRows: ScheduledSessionRow[] = [];
  let sessionsError: { message: string } | null = null;
  try {
    sessionRows = await fetchAdminSessions(supabase, tutorUserIds);
  } catch (e) {
    sessionsError = { message: e instanceof Error ? e.message : "Failed to load sessions." };
  }

  if (profilesError) {
    return { tutors: [], sessions: [], schemaReady: true, error: profilesError.message };
  }
  if (authError) {
    return { tutors: [], sessions: [], schemaReady: true, error: authError.message };
  }
  if (allProfilesError) {
    return { tutors: [], sessions: [], schemaReady: true, error: allProfilesError.message };
  }

  const schemaReady = !connectionsError && !sessionsError;
  if (connectionsError?.message?.includes("tutor_google_calendar_connections")) {
    return { tutors: [], sessions: [], schemaReady: false };
  }
  if (sessionsError?.message?.includes("tutor_scheduled_sessions")) {
    return { tutors: [], sessions: [], schemaReady: false };
  }
  if (connectionsError) {
    return { tutors: [], sessions: [], schemaReady: true, error: connectionsError.message };
  }
  if (sessionsError) {
    return { tutors: [], sessions: [], schemaReady: true, error: sessionsError.message };
  }

  const authUsers = authData?.users ?? [];
  const { profileById, userIdByEmail } = buildAccountLookup(authUsers, allProfiles ?? []);

  const emailById = new Map(authUsers.map((user) => [user.id, user.email ?? null] as const));
  const profileByTutorId = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  const connectionByTutor = new Map(
    (connections ?? []).map((row) => [row.tutor_id, row] as const)
  );

  const tutorEmailsByTutorId = new Map<string, Set<string>>();
  for (const tutorId of tutorUserIds) {
    const emails = new Set<string>();
    const tutorAuthEmail = emailById.get(tutorId);
    if (tutorAuthEmail) emails.add(normalizeEmail(tutorAuthEmail));
    const connection = connectionByTutor.get(tutorId);
    if (connection?.google_account_email) {
      emails.add(normalizeEmail(connection.google_account_email));
    }
    tutorEmailsByTutorId.set(tutorId, emails);
  }

  const exclusionsByTutor = new Map<string, CalendarExclusionRow[]>();
  if (!exclusionsError) {
    for (const row of exclusionRows ?? []) {
      const list = exclusionsByTutor.get(row.tutor_id) ?? [];
      list.push({
        google_event_id: row.google_event_id,
        google_recurring_event_id: row.google_recurring_event_id,
        scope: row.scope,
      });
      exclusionsByTutor.set(row.tutor_id, list);
    }
  }

  const nowIso = new Date().toISOString();
  const lessonCountByTutor = new Map<string, number>();
  const loadedCountByTutor = new Map<string, number>();
  for (const session of sessionRows) {
    loadedCountByTutor.set(
      session.tutor_id,
      (loadedCountByTutor.get(session.tutor_id) ?? 0) + 1
    );
    if (session.starts_at >= nowIso) {
      lessonCountByTutor.set(
        session.tutor_id,
        (lessonCountByTutor.get(session.tutor_id) ?? 0) + 1
      );
    }
  }

  const tutors: AdminTutorCalendarRow[] = tutorUserIds
    .map((tutorId) => {
      const profile = profileByTutorId.get(tutorId);
      const roles = rolesByUser.get(tutorId) ?? [];
      const connection = connectionByTutor.get(tutorId);
      return {
        tutorId,
        displayName:
          (profile ? getDisplayName(profile) : null) ??
          emailById.get(tutorId) ??
          connection?.google_account_email ??
          "Tutor",
        email: emailById.get(tutorId) ?? null,
        appRoles: roles,
        connected: Boolean(connection),
        googleAccountEmail: connection?.google_account_email ?? null,
        connectedAt: connection?.connected_at ?? null,
        lastSyncedAt: connection?.last_synced_at ?? null,
        upcomingLessonCount: lessonCountByTutor.get(tutorId) ?? 0,
        loadedEventCount: loadedCountByTutor.get(tutorId) ?? 0,
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const studentIds = [
    ...new Set(sessionRows.map((row) => row.student_id).filter((id): id is string => Boolean(id))),
  ];
  const cohortIds = [
    ...new Set(sessionRows.map((row) => row.cohort_id).filter((id): id is string => Boolean(id))),
  ];

  const [{ data: students }, { data: cohorts }] = await Promise.all([
    studentIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, full_name, preferred_name")
          .in("id", studentIds)
      : Promise.resolve({ data: [] }),
    cohortIds.length > 0
      ? supabase.from("cohorts").select("id, name").in("id", cohortIds)
      : Promise.resolve({ data: [] }),
  ]);

  const studentNameById = new Map(
    (students ?? []).map((student) => [student.id, getDisplayName(student) ?? "Student"])
  );
  const cohortNameById = new Map((cohorts ?? []).map((cohort) => [cohort.id, cohort.name]));
  const tutorNameById = new Map(tutors.map((tutor) => [tutor.tutorId, tutor.displayName]));

  const sessions: AdminTutorCalendarSession[] = sessionRows.map((session) => ({
    id: session.id,
    tutorId: session.tutor_id,
    tutorName: tutorNameById.get(session.tutor_id) ?? "Tutor",
    title: session.title,
    starts_at: session.starts_at,
    ends_at: session.ends_at,
    meet_link: session.meet_link,
    studentName: session.student_id ? (studentNameById.get(session.student_id) ?? null) : null,
    cohortName: session.cohort_id ? (cohortNameById.get(session.cohort_id) ?? null) : null,
    matchMethod: session.match_method,
    excludedByTutor: isSessionExcluded(session, exclusionsByTutor.get(session.tutor_id) ?? []),
    attendeeEmails: session.attendee_emails ?? [],
    attendees: resolveAttendees(
      session.attendee_emails ?? [],
      tutorEmailsByTutorId.get(session.tutor_id) ?? new Set(),
      userIdByEmail,
      profileById
    ),
  }));

  return { tutors, sessions, schemaReady: true };
}
