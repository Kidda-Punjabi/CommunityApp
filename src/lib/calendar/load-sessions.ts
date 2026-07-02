import type { SupabaseClient } from "@supabase/supabase-js";
import { getCohortSwitchEligibility } from "@/lib/calendar/cohort-switch-policy";
import { getRescheduleEligibility } from "@/lib/calendar/reschedule-policy";
import type {
  CohortSwitchRequestRow,
  RescheduleRequestRow,
  ScheduledSessionRow,
  StudentScheduledSession,
  TutorCalendarConnectionStatus,
  TutorScheduledSession,
} from "@/lib/calendar/types";
import { getDisplayName } from "@/lib/profile/display-name";
import { isCalendarSchemaMissingError } from "@/lib/calendar/schema";
import { isStoredSessionExcluded, type CalendarExclusionRow } from "@/lib/calendar/exclusions";
import { isSessionVisibleToStudent, type StudentEnrollmentContext } from "@/lib/calendar/session-visibility";

const IN_FILTER_CHUNK_SIZE = 80;

async function fetchRowsInChunks<T>(
  ids: string[],
  fetchChunk: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  if (ids.length === 0) return [];

  const rows: T[] = [];
  for (let index = 0; index < ids.length; index += IN_FILTER_CHUNK_SIZE) {
    const chunk = ids.slice(index, index + IN_FILTER_CHUNK_SIZE);
    const { data, error } = await fetchChunk(chunk);
    if (error) throw error;
    if (data) rows.push(...data);
  }
  return rows;
}

async function loadExclusionsForTutors(
  supabase: SupabaseClient,
  tutorIds: string[]
): Promise<Map<string, CalendarExclusionRow[]>> {
  const byTutor = new Map<string, CalendarExclusionRow[]>();
  if (tutorIds.length === 0) return byTutor;

  const rows = await fetchRowsInChunks(tutorIds, (chunk) =>
    supabase
      .from("tutor_calendar_event_exclusions")
      .select("tutor_id, google_event_id, google_recurring_event_id, scope")
      .in("tutor_id", chunk)
  );

  for (const row of rows) {
    const list = byTutor.get(row.tutor_id) ?? [];
    list.push({
      google_event_id: row.google_event_id,
      google_recurring_event_id: row.google_recurring_event_id,
      scope: row.scope,
    });
    byTutor.set(row.tutor_id, list);
  }

  return byTutor;
}

function filterExcludedSessions<T extends ScheduledSessionRow>(
  sessions: T[],
  exclusionsByTutor: Map<string, CalendarExclusionRow[]>
): T[] {
  return sessions.filter(
    (session) =>
      !isStoredSessionExcluded(session, exclusionsByTutor.get(session.tutor_id) ?? [])
  );
}

export type StudentSessionsLoadResult = {
  sessions: StudentScheduledSession[];
  schemaReady: boolean;
};

export async function loadTutorCalendarStatus(
  supabase: SupabaseClient
): Promise<TutorCalendarConnectionStatus & { schemaReady: boolean }> {
  const { data, error } = await supabase.rpc("get_tutor_calendar_connection_status");
  if (error) {
    if (isCalendarSchemaMissingError(error)) {
      return { connected: false, schemaReady: false };
    }
    if (error.code === "P0001" && error.message?.includes("Tutor access required")) {
      return { connected: false, schemaReady: true };
    }
    throw error;
  }
  const payload = data as TutorCalendarConnectionStatus;
  return { ...payload, schemaReady: true };
}

export async function loadStudentUpcomingSessions(
  supabase: SupabaseClient,
  studentId: string,
  studentEmail: string | null | undefined
): Promise<StudentSessionsLoadResult> {
  const nowIso = new Date().toISOString();

  const { data: enrollments, error: enrollmentsError } = await supabase
    .from("course_enrollments")
    .select("tutor_id, cohort_id, delivery_mode")
    .eq("user_id", studentId);

  if (enrollmentsError) {
    if (isCalendarSchemaMissingError(enrollmentsError)) {
      return { sessions: [], schemaReady: false };
    }
    throw enrollmentsError;
  }

  const tutorIds = [
    ...new Set((enrollments ?? []).map((enrollment) => enrollment.tutor_id).filter(Boolean)),
  ];

  if (tutorIds.length === 0) {
    return { sessions: [], schemaReady: true };
  }

  const { data: sessions, error } = await supabase
    .from("tutor_scheduled_sessions")
    .select("*")
    .in("tutor_id", tutorIds)
    .eq("status", "scheduled")
    .neq("match_method", "unmatched")
    .neq("match_method", "title_name")
    .gte("starts_at", nowIso)
    .order("starts_at", { ascending: true });

  if (error) {
    if (isCalendarSchemaMissingError(error)) {
      return { sessions: [], schemaReady: false };
    }
    throw error;
  }

  const exclusionsByTutor = await loadExclusionsForTutors(supabase, tutorIds);
  const withoutExcluded = filterExcludedSessions(
    (sessions ?? []) as ScheduledSessionRow[],
    exclusionsByTutor
  );

  const enrollmentContext = (enrollments ?? []).map((enrollment) => ({
    tutorId: enrollment.tutor_id,
    cohortId: enrollment.cohort_id,
    deliveryMode: enrollment.delivery_mode as StudentEnrollmentContext["deliveryMode"],
  }));

  const normalizedEmail = studentEmail?.trim().toLowerCase() ?? "";
  const visible = withoutExcluded.filter((session) =>
    isSessionVisibleToStudent(session, studentId, normalizedEmail, enrollmentContext)
  );
  if (visible.length === 0) {
    return { sessions: [], schemaReady: true };
  }

  const sessionIds = visible.map((session) => session.id);
  const sessionTutorIds = [...new Set(visible.map((session) => session.tutor_id))];
  const groupCohortIds = [
    ...new Set(
      visible.map((session) => session.cohort_id).filter((id): id is string => Boolean(id))
    ),
  ];

  const [
    { data: requests, error: requestsError },
    { data: tutors, error: tutorsError },
    { data: cohortSwitchRequests, error: cohortSwitchError },
    { data: sessionCohorts, error: sessionCohortsError },
  ] = await Promise.all([
    supabase
      .from("lesson_reschedule_requests")
      .select("*")
      .eq("student_id", studentId)
      .in("session_id", sessionIds),
    supabase
      .from("profiles")
      .select("id, full_name, preferred_name")
      .in("id", sessionTutorIds),
    supabase
      .from("cohort_switch_requests")
      .select("*")
      .eq("student_id", studentId)
      .in("session_id", sessionIds),
    groupCohortIds.length > 0
      ? supabase.from("cohorts").select("id, name, tutor_id, course_id").in("id", groupCohortIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (requestsError && !isCalendarSchemaMissingError(requestsError)) throw requestsError;
  if (tutorsError) throw tutorsError;
  if (cohortSwitchError && !isCalendarSchemaMissingError(cohortSwitchError)) {
    throw cohortSwitchError;
  }
  if (sessionCohortsError) throw sessionCohortsError;

  const tutorIdsForAlternates = [
    ...new Set((sessionCohorts ?? []).map((cohort) => cohort.tutor_id).filter(Boolean)),
  ];
  const { data: tutorCohorts } =
    tutorIdsForAlternates.length > 0
      ? await supabase
          .from("cohorts")
          .select("id, name, tutor_id, course_id")
          .in("tutor_id", tutorIdsForAlternates)
          .eq("active", true)
      : { data: [] };

  const requestBySession = new Map(
    ((requests ?? []) as RescheduleRequestRow[]).map((request) => [request.session_id, request])
  );
  const cohortSwitchBySession = new Map(
    ((cohortSwitchRequests ?? []) as CohortSwitchRequestRow[]).map((request) => [
      request.session_id,
      request,
    ])
  );
  const tutorNameById = new Map(
    (tutors ?? []).map((tutor) => [tutor.id, getDisplayName(tutor) ?? "Your tutor"])
  );
  const cohortMetaById = new Map((sessionCohorts ?? []).map((cohort) => [cohort.id, cohort]));

  function getAlternateCohorts(session: ScheduledSessionRow) {
    if (!session.cohort_id) return [];
    const current = cohortMetaById.get(session.cohort_id);
    if (!current) return [];

    return (tutorCohorts ?? [])
      .filter(
        (cohort) =>
          cohort.tutor_id === current.tutor_id &&
          cohort.course_id === current.course_id &&
          cohort.id !== session.cohort_id
      )
      .map((cohort) => ({ id: cohort.id, name: cohort.name }));
  }

  return {
    schemaReady: true,
    sessions: visible.map((session) => {
      const rescheduleRequest = requestBySession.get(session.id) ?? null;
      const eligibility = getRescheduleEligibility(session, rescheduleRequest);
      const cohortSwitchRequest = cohortSwitchBySession.get(session.id) ?? null;
      const alternateCohorts = getAlternateCohorts(session);
      const cohortSwitchEligibility = getCohortSwitchEligibility(
        session,
        cohortSwitchRequest,
        alternateCohorts.length
      );

      return {
        ...session,
        tutorName: tutorNameById.get(session.tutor_id) ?? "Your tutor",
        cohortName: session.cohort_id
          ? (cohortMetaById.get(session.cohort_id)?.name ?? null)
          : null,
        rescheduleRequest,
        canRequestReschedule: eligibility.canRequest,
        rescheduleLockedReason: eligibility.lockedReason,
        cohortSwitchRequest,
        canRequestCohortSwitch: cohortSwitchEligibility.canRequest,
        cohortSwitchLockedReason: cohortSwitchEligibility.lockedReason,
        alternateCohorts,
      };
    }),
  };
}

export async function loadTutorUpcomingSessions(
  supabase: SupabaseClient,
  tutorId: string
): Promise<{ sessions: TutorScheduledSession[]; schemaReady: boolean }> {
  const nowIso = new Date().toISOString();

  const { data: sessions, error } = await supabase
    .from("tutor_scheduled_sessions")
    .select("*")
    .eq("tutor_id", tutorId)
    .eq("status", "scheduled")
    .neq("match_method", "unmatched")
    .neq("match_method", "title_name")
    .gte("starts_at", nowIso)
    .order("starts_at", { ascending: true });

  if (error) {
    if (isCalendarSchemaMissingError(error)) {
      return { sessions: [], schemaReady: false };
    }
    throw error;
  }

  const exclusionsByTutor = await loadExclusionsForTutors(supabase, [tutorId]);
  const rows = filterExcludedSessions((sessions ?? []) as ScheduledSessionRow[], exclusionsByTutor);
  if (rows.length === 0) {
    return { sessions: [], schemaReady: true };
  }

  const studentIds = [
    ...new Set(rows.map((row) => row.student_id).filter((id): id is string => Boolean(id))),
  ];
  const cohortIds = [
    ...new Set(rows.map((row) => row.cohort_id).filter((id): id is string => Boolean(id))),
  ];

  const [students, cohorts, { data: pendingRows, error: pendingError }] = await Promise.all([
    fetchRowsInChunks(studentIds, (chunk) =>
      supabase.from("profiles").select("id, full_name, preferred_name").in("id", chunk)
    ),
    fetchRowsInChunks(cohortIds, (chunk) =>
      supabase.from("cohorts").select("id, name").in("id", chunk)
    ),
    supabase
      .from("lesson_reschedule_requests")
      .select("session_id, tutor_scheduled_sessions!inner(tutor_id)")
      .eq("status", "pending")
      .eq("tutor_scheduled_sessions.tutor_id", tutorId),
  ]);

  if (pendingError && !isCalendarSchemaMissingError(pendingError)) throw pendingError;

  const studentNameById = new Map(
    (students ?? []).map((student) => [student.id, getDisplayName(student) ?? "Student"])
  );
  const cohortNameById = new Map((cohorts ?? []).map((cohort) => [cohort.id, cohort.name]));

  const pendingCountBySession = new Map<string, number>();
  for (const request of pendingRows ?? []) {
    pendingCountBySession.set(
      request.session_id,
      (pendingCountBySession.get(request.session_id) ?? 0) + 1
    );
  }

  return {
    schemaReady: true,
    sessions: rows.map((session) => ({
      ...session,
      studentName: session.student_id ? (studentNameById.get(session.student_id) ?? null) : null,
      cohortName: session.cohort_id ? (cohortNameById.get(session.cohort_id) ?? null) : null,
      pendingRescheduleCount: pendingCountBySession.get(session.id) ?? 0,
    })),
  };
}

export async function loadTutorPendingRescheduleRequests(
  supabase: SupabaseClient,
  tutorId: string
): Promise<{
  requests: Array<
    RescheduleRequestRow & {
      sessionTitle: string;
      sessionStartsAt: string | null;
      sessionEndsAt: string | null;
      studentName: string;
    }
  >;
  schemaReady: boolean;
}> {
  const { data: rows, error } = await supabase
    .from("lesson_reschedule_requests")
    .select(
      `
      *,
      session:tutor_scheduled_sessions!inner(
        title,
        starts_at,
        ends_at,
        tutor_id
      )
    `
    )
    .eq("status", "pending")
    .eq("tutor_scheduled_sessions.tutor_id", tutorId)
    .order("created_at", { ascending: true });

  if (error) {
    if (isCalendarSchemaMissingError(error)) {
      return { requests: [], schemaReady: false };
    }
    throw error;
  }

  const requests = (rows ?? []) as Array<
    RescheduleRequestRow & {
      session: {
        title: string;
        starts_at: string;
        ends_at: string;
        tutor_id: string;
      };
    }
  >;

  const studentIds = [...new Set(requests.map((request) => request.student_id))];
  const { data: students } =
    studentIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, preferred_name")
          .in("id", studentIds)
      : { data: [] };

  const studentNameById = new Map(
    (students ?? []).map((student) => [student.id, getDisplayName(student) ?? "Student"])
  );

  return {
    schemaReady: true,
    requests: requests.map((request) => ({
      ...request,
      sessionTitle: request.session?.title ?? "Lesson",
      sessionStartsAt: request.session?.starts_at ?? null,
      sessionEndsAt: request.session?.ends_at ?? null,
      studentName: studentNameById.get(request.student_id) ?? "Student",
    })),
  };
}

export async function loadTutorPendingCohortSwitchRequests(
  supabase: SupabaseClient,
  tutorId: string
): Promise<{
  requests: Array<
    CohortSwitchRequestRow & {
      sessionTitle: string;
      sessionStartsAt: string | null;
      sessionEndsAt: string | null;
      studentName: string;
      fromCohortName: string;
      toCohortName: string;
    }
  >;
  schemaReady: boolean;
}> {
  const { data: rows, error } = await supabase
    .from("cohort_switch_requests")
    .select(
      `
      *,
      session:tutor_scheduled_sessions!inner(
        title,
        starts_at,
        ends_at,
        tutor_id
      )
    `
    )
    .eq("status", "pending")
    .eq("tutor_scheduled_sessions.tutor_id", tutorId)
    .order("created_at", { ascending: true });

  if (error) {
    if (isCalendarSchemaMissingError(error)) {
      return { requests: [], schemaReady: false };
    }
    throw error;
  }

  const requests = (rows ?? []) as Array<
    CohortSwitchRequestRow & {
      session: {
        title: string;
        starts_at: string;
        ends_at: string;
        tutor_id: string;
      };
    }
  >;

  const studentIds = [...new Set(requests.map((request) => request.student_id))];
  const cohortIds = [
    ...new Set(
      requests.flatMap((request) => [request.from_cohort_id, request.to_cohort_id])
    ),
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

  return {
    schemaReady: true,
    requests: requests.map((request) => ({
      ...request,
      sessionTitle: request.session?.title ?? "Lesson",
      sessionStartsAt: request.session?.starts_at ?? null,
      sessionEndsAt: request.session?.ends_at ?? null,
      studentName: studentNameById.get(request.student_id) ?? "Student",
      fromCohortName: cohortNameById.get(request.from_cohort_id) ?? "Current cohort",
      toCohortName: cohortNameById.get(request.to_cohort_id) ?? "Alternate cohort",
    })),
  };
}

export async function loadTutorPendingRequestCounts(
  supabase: SupabaseClient,
  tutorId: string
): Promise<{ rescheduleCount: number; cohortSwitchCount: number; total: number }> {
  const [rescheduleLoad, cohortSwitchLoad] = await Promise.all([
    loadTutorPendingRescheduleRequests(supabase, tutorId),
    loadTutorPendingCohortSwitchRequests(supabase, tutorId),
  ]);

  const rescheduleCount = rescheduleLoad.requests.length;
  const cohortSwitchCount = cohortSwitchLoad.requests.length;

  return {
    rescheduleCount,
    cohortSwitchCount,
    total: rescheduleCount + cohortSwitchCount,
  };
}
