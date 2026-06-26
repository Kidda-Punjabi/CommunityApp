import type { SupabaseClient } from "@supabase/supabase-js";
import { getRescheduleEligibility } from "@/lib/calendar/reschedule-policy";
import type {
  RescheduleRequestRow,
  ScheduledSessionRow,
  StudentScheduledSession,
  TutorCalendarConnectionStatus,
  TutorScheduledSession,
} from "@/lib/calendar/types";
import { getDisplayName } from "@/lib/profile/display-name";
import { isCalendarSchemaMissingError } from "@/lib/calendar/schema";

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
  studentId: string
): Promise<StudentSessionsLoadResult> {
  const nowIso = new Date().toISOString();

  const { data: sessions, error } = await supabase
    .from("tutor_scheduled_sessions")
    .select("*")
    .eq("status", "scheduled")
    .gte("starts_at", nowIso)
    .order("starts_at", { ascending: true });

  if (error) {
    if (isCalendarSchemaMissingError(error)) {
      return { sessions: [], schemaReady: false };
    }
    throw error;
  }

  const visible = (sessions ?? []) as ScheduledSessionRow[];
  if (visible.length === 0) {
    return { sessions: [], schemaReady: true };
  }

  const sessionIds = visible.map((session) => session.id);
  const tutorIds = [...new Set(visible.map((session) => session.tutor_id))];

  const [{ data: requests, error: requestsError }, { data: tutors, error: tutorsError }] =
    await Promise.all([
      supabase
        .from("lesson_reschedule_requests")
        .select("*")
        .eq("student_id", studentId)
        .in("session_id", sessionIds),
      supabase
        .from("profiles")
        .select("id, full_name, preferred_name")
        .in("id", tutorIds),
    ]);

  if (requestsError && !isCalendarSchemaMissingError(requestsError)) throw requestsError;
  if (tutorsError) throw tutorsError;

  const requestBySession = new Map(
    ((requests ?? []) as RescheduleRequestRow[]).map((request) => [request.session_id, request])
  );
  const tutorNameById = new Map(
    (tutors ?? []).map((tutor) => [tutor.id, getDisplayName(tutor) ?? "Your tutor"])
  );

  return {
    schemaReady: true,
    sessions: visible.map((session) => {
      const rescheduleRequest = requestBySession.get(session.id) ?? null;
      const eligibility = getRescheduleEligibility(session, rescheduleRequest);

      return {
        ...session,
        tutorName: tutorNameById.get(session.tutor_id) ?? "Your tutor",
        rescheduleRequest,
        canRequestReschedule: eligibility.canRequest,
        rescheduleLockedReason: eligibility.lockedReason,
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
    .gte("starts_at", nowIso)
    .order("starts_at", { ascending: true });

  if (error) {
    if (isCalendarSchemaMissingError(error)) {
      return { sessions: [], schemaReady: false };
    }
    throw error;
  }

  const rows = (sessions ?? []) as ScheduledSessionRow[];
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
