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

export async function loadTutorCalendarStatus(
  supabase: SupabaseClient
): Promise<TutorCalendarConnectionStatus> {
  const { data, error } = await supabase.rpc("get_tutor_calendar_connection_status");
  if (error) throw error;
  const payload = data as TutorCalendarConnectionStatus;
  return payload;
}

export async function loadStudentUpcomingSessions(
  supabase: SupabaseClient,
  studentId: string
): Promise<StudentScheduledSession[]> {
  const nowIso = new Date().toISOString();

  const { data: sessions, error } = await supabase
    .from("tutor_scheduled_sessions")
    .select("*")
    .eq("status", "scheduled")
    .gte("starts_at", nowIso)
    .order("starts_at", { ascending: true });

  if (error) throw error;

  const visible = (sessions ?? []) as ScheduledSessionRow[];
  if (visible.length === 0) return [];

  const sessionIds = visible.map((session) => session.id);
  const tutorIds = [...new Set(visible.map((session) => session.tutor_id))];

  const [{ data: requests }, { data: tutors }] = await Promise.all([
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

  const requestBySession = new Map(
    ((requests ?? []) as RescheduleRequestRow[]).map((request) => [request.session_id, request])
  );
  const tutorNameById = new Map(
    (tutors ?? []).map((tutor) => [tutor.id, getDisplayName(tutor) ?? "Your tutor"])
  );

  return visible.map((session) => {
    const rescheduleRequest = requestBySession.get(session.id) ?? null;
    const eligibility = getRescheduleEligibility(session, rescheduleRequest);

    return {
      ...session,
      tutorName: tutorNameById.get(session.tutor_id) ?? "Your tutor",
      rescheduleRequest,
      canRequestReschedule: eligibility.canRequest,
      rescheduleLockedReason: eligibility.lockedReason,
    };
  });
}

export async function loadTutorUpcomingSessions(
  supabase: SupabaseClient,
  tutorId: string
): Promise<TutorScheduledSession[]> {
  const nowIso = new Date().toISOString();

  const { data: sessions, error } = await supabase
    .from("tutor_scheduled_sessions")
    .select("*")
    .eq("tutor_id", tutorId)
    .eq("status", "scheduled")
    .gte("starts_at", nowIso)
    .order("starts_at", { ascending: true });

  if (error) throw error;

  const rows = (sessions ?? []) as ScheduledSessionRow[];
  if (rows.length === 0) return [];

  const studentIds = rows.map((row) => row.student_id).filter((id): id is string => Boolean(id));
  const cohortIds = rows.map((row) => row.cohort_id).filter((id): id is string => Boolean(id));
  const sessionIds = rows.map((row) => row.id);

  const [{ data: students }, { data: cohorts }, { data: requests }] = await Promise.all([
    studentIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, full_name, preferred_name")
          .in("id", studentIds)
      : Promise.resolve({
          data: [] as { id: string; full_name: string | null; preferred_name: string | null }[],
        }),
    cohortIds.length > 0
      ? supabase.from("cohorts").select("id, name").in("id", cohortIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    supabase
      .from("lesson_reschedule_requests")
      .select("session_id, status")
      .in("session_id", sessionIds)
      .eq("status", "pending"),
  ]);

  const studentNameById = new Map(
    (students ?? []).map((student) => [student.id, getDisplayName(student) ?? "Student"])
  );
  const cohortNameById = new Map((cohorts ?? []).map((cohort) => [cohort.id, cohort.name]));

  const pendingCountBySession = new Map<string, number>();
  for (const request of requests ?? []) {
    pendingCountBySession.set(
      request.session_id,
      (pendingCountBySession.get(request.session_id) ?? 0) + 1
    );
  }

  return rows.map((session) => ({
    ...session,
    studentName: session.student_id ? (studentNameById.get(session.student_id) ?? null) : null,
    cohortName: session.cohort_id ? (cohortNameById.get(session.cohort_id) ?? null) : null,
    pendingRescheduleCount: pendingCountBySession.get(session.id) ?? 0,
  }));
}

export async function loadTutorPendingRescheduleRequests(
  supabase: SupabaseClient,
  tutorId: string
) {
  const { data: sessions, error: sessionsError } = await supabase
    .from("tutor_scheduled_sessions")
    .select("id, title, starts_at, ends_at")
    .eq("tutor_id", tutorId);

  if (sessionsError) throw sessionsError;

  const sessionIds = (sessions ?? []).map((session) => session.id);
  if (sessionIds.length === 0) return [];

  const { data: requests, error } = await supabase
    .from("lesson_reschedule_requests")
    .select("*")
    .in("session_id", sessionIds)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw error;

  const sessionById = new Map((sessions ?? []).map((session) => [session.id, session]));
  const studentIds = [...new Set((requests ?? []).map((request) => request.student_id))];

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

  return ((requests ?? []) as RescheduleRequestRow[]).map((request) => {
    const session = sessionById.get(request.session_id);
    return {
      ...request,
    sessionTitle: session?.title ?? "Lesson",
    sessionStartsAt: session?.starts_at ?? null,
    sessionEndsAt: session?.ends_at ?? null,
      studentName: studentNameById.get(request.student_id) ?? "Student",
    };
  });
}
