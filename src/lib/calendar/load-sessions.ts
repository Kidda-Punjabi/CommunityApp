import type { SupabaseClient } from "@supabase/supabase-js";
import { getCohortSwitchEligibility } from "@/lib/calendar/cohort-switch-policy";
import { getRescheduleEligibility } from "@/lib/calendar/reschedule-policy";
import {
  appliesBeginnersRescheduleLimit,
  loadBeginnersRescheduleLimitStatus,
} from "@/lib/calendar/reschedule-limit";
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
import { isValidCohortSwitchCandidateSession } from "@/lib/calendar/cohort-switch-candidates";
import { isStoredSessionExcluded, type CalendarExclusionRow } from "@/lib/calendar/exclusions";
import { attachLessonLabelsToSessions } from "@/lib/calendar/session-lesson-labels";
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

  const rawCohortSwitchRequests = (cohortSwitchRequests ?? []) as CohortSwitchRequestRow[];
  const targetSessionIds = [
    ...new Set(
      rawCohortSwitchRequests
        .map((request) => request.to_session_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const targetCohortIds = [
    ...new Set(rawCohortSwitchRequests.map((request) => request.to_cohort_id).filter(Boolean)),
  ];

  const [{ data: targetSessions }, { data: targetCohorts }] = await Promise.all([
    targetSessionIds.length > 0
      ? supabase
          .from("tutor_scheduled_sessions")
          .select("id, starts_at, ends_at, cohort_id, title")
          .in("id", targetSessionIds)
      : Promise.resolve({ data: [] }),
    targetCohortIds.length > 0
      ? supabase.from("cohorts").select("id, name").in("id", targetCohortIds)
      : Promise.resolve({ data: [] }),
  ]);

  const targetSessionById = new Map(
    (targetSessions ?? []).map((row) => [
      row.id as string,
      {
        startsAt: row.starts_at as string,
        endsAt: row.ends_at as string,
        cohortId: (row.cohort_id as string | null) ?? null,
        title: (row.title as string | null) ?? null,
      },
    ])
  );
  const targetCohortNameById = new Map(
    (targetCohorts ?? []).map((cohort) => [cohort.id as string, cohort.name as string])
  );

  const requestBySession = new Map(
    ((requests ?? []) as RescheduleRequestRow[]).map((request) => [request.session_id, request])
  );
  const cohortSwitchBySession = new Map(
    rawCohortSwitchRequests.map((request) => {
      const target = request.to_session_id
        ? targetSessionById.get(request.to_session_id)
        : undefined;
      const enriched: CohortSwitchRequestRow = {
        ...request,
        toSessionStartsAt: target?.startsAt ?? null,
        toSessionEndsAt: target?.endsAt ?? null,
        toCohortName:
          targetCohortNameById.get(request.to_cohort_id) ??
          target?.title ??
          null,
      };
      return [request.session_id, enriched] as const;
    })
  );
  const tutorNameById = new Map(
    (tutors ?? []).map((tutor) => [tutor.id, getDisplayName(tutor) ?? "Your tutor"])
  );
  const cohortMetaById = new Map((sessionCohorts ?? []).map((cohort) => [cohort.id, cohort]));

  const labelled = await attachLessonLabelsToSessions(supabase, visible);
  const labelledById = new Map(labelled.map((session) => [session.id, session]));
  const beginnersRescheduleLimit = await loadBeginnersRescheduleLimitStatus(supabase, studentId);

  const groupSessions = labelled.filter(
    (session) => Boolean(session.cohort_id) && Boolean(session.course_id)
  );
  const alternateSessionBySourceId = new Map<string, Array<(typeof labelled)[number]>>();

  if (groupSessions.length > 0) {
    const courseIdsForAlternates = [
      ...new Set(groupSessions.map((session) => session.course_id).filter((id): id is string => Boolean(id))),
    ];
    const fromIso = new Date(
      Math.min(...groupSessions.map((session) => new Date(session.starts_at).getTime()))
    ).toISOString();
    const toIso = new Date(
      Math.max(...groupSessions.map((session) => new Date(session.starts_at).getTime())) +
        10 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: alternateRows, error: alternateError } =
      courseIdsForAlternates.length > 0
        ? await supabase
            .from("tutor_scheduled_sessions")
            .select("*")
            .in("course_id", courseIdsForAlternates)
            .not("cohort_id", "is", null)
            .eq("status", "scheduled")
            .neq("match_method", "unmatched")
            .neq("match_method", "title_name")
            .gte("starts_at", fromIso)
            .lte("starts_at", toIso)
            .order("starts_at", { ascending: true })
        : { data: [], error: null };

    if (alternateError) throw alternateError;

    const alternateLabelled = await attachLessonLabelsToSessions(
      supabase,
      ((alternateRows ?? []) as ScheduledSessionRow[]).filter((session) => {
        if (labelledById.has(session.id)) return false;
        return isValidCohortSwitchCandidateSession(session);
      })
    );

    for (const source of groupSessions) {
      const matches = alternateLabelled.filter((candidate) => {
        if (!source.cohort_id || !candidate.cohort_id || !source.course_id || !source.lessonNumber) {
          return false;
        }
        if (candidate.cohort_id === source.cohort_id) return false;
        if (candidate.course_id !== source.course_id) return false;
        if (candidate.lessonNumber !== source.lessonNumber) return false;
        const sourceMs = new Date(source.starts_at).getTime();
        const candidateMs = new Date(candidate.starts_at).getTime();
        return candidateMs >= sourceMs && candidateMs <= sourceMs + 10 * 24 * 60 * 60 * 1000;
      });
      alternateSessionBySourceId.set(source.id, matches);
    }
  }

  return {
    schemaReady: true,
    sessions: labelled.map((session) => {
      const rescheduleRequest = requestBySession.get(session.id) ?? null;
      const rescheduleLimitLockedReason = appliesBeginnersRescheduleLimit(
        session.course_id,
        beginnersRescheduleLimit
      )
        ? beginnersRescheduleLimit.lockedReason
        : null;
      const eligibility = getRescheduleEligibility(session, rescheduleRequest, {
        rescheduleLimitLockedReason,
      });
      const cohortSwitchRequest = cohortSwitchBySession.get(session.id) ?? null;
      const alternateCohorts = (alternateSessionBySourceId.get(session.id) ?? []).map((candidate) => ({
        id: candidate.id,
        cohortId: candidate.cohort_id as string,
        name: cohortMetaById.get(candidate.cohort_id as string)?.name ?? candidate.title ?? "Alternate cohort",
        tutorName: tutorNameById.get(candidate.tutor_id) ?? "Tutor",
        startsAt: candidate.starts_at,
        endsAt: candidate.ends_at,
        lessonLabel: candidate.lessonLabel,
      }));
      const cohortSwitchEligibility = getCohortSwitchEligibility(
        session,
        cohortSwitchRequest,
        alternateCohorts.length,
        { rescheduleLimitLockedReason }
      );

      return {
        ...session,
        tutorName: tutorNameById.get(session.tutor_id) ?? "Your tutor",
        cohortName: session.cohort_id
          ? (cohortMetaById.get(session.cohort_id)?.name ?? null)
          : null,
        lessonNumber: session.lessonNumber,
        lessonLabel: session.lessonLabel,
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
  const courseIds = [
    ...new Set(rows.map((row) => row.course_id).filter((id): id is string => Boolean(id))),
  ];
  const sessionIds = rows.map((row) => row.id);

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

  const linkedPackageBySession = new Map<
    string,
    { packageId: string; packageName: string | null; bySeries: boolean }
  >();
  const packageLinkCountByPackageId = new Map<string, number>();
  const suggestedPackageBySession = new Map<string, { id: string; name: string | null }>();
  const logBySession = new Map<
    string,
    {
      completed: boolean;
      attendanceMarked: boolean;
      attendanceStatus: "present" | "absent_notified" | "absent_unnotified" | null;
      homeworkMarked: boolean;
    }
  >();

  if (sessionIds.length > 0) {
    const [{ data: linkRows }, { data: logRows }, { data: enrollmentRows }] = await Promise.all([
      supabase
        .from("tutor_session_package_links")
        .select("session_id, student_package_id, link_scope")
        .in("session_id", sessionIds),
      supabase
        .from("tutor_session_logs")
        .select("session_id, completed, attendance_marked, attendance_status, homework_marked")
        .in("session_id", sessionIds),
      supabase
        .from("course_enrollments")
        .select("id, user_id, cohort_id, course_id, student_package_id")
        .eq("tutor_id", tutorId)
        .in("course_id", courseIds.length > 0 ? courseIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);

    const linkedPackageIds = [
      ...new Set((linkRows ?? []).map((row) => row.student_package_id).filter(Boolean)),
    ] as string[];
    const suggestedPackageIds = [
      ...new Set((enrollmentRows ?? []).map((row) => row.student_package_id).filter(Boolean)),
    ] as string[];
    const allPackageIds = [...new Set([...linkedPackageIds, ...suggestedPackageIds])];

    let packageNameById = new Map<string, string | null>();
    if (allPackageIds.length > 0) {
      const { data: packageRows } = await supabase
        .from("student_packages")
        .select("id, package:packages(name)")
        .in("id", allPackageIds);

      packageNameById = new Map(
        (packageRows ?? []).map((row) => {
          const rel = row.package as { name?: string } | Array<{ name?: string }> | null;
          const name = Array.isArray(rel) ? rel[0]?.name ?? null : rel?.name ?? null;
          return [row.id as string, name] as const;
        })
      );

      const { data: countRows } = await supabase
        .from("tutor_session_package_links")
        .select("student_package_id")
        .in("student_package_id", allPackageIds);
      for (const row of countRows ?? []) {
        const key = row.student_package_id as string;
        packageLinkCountByPackageId.set(key, (packageLinkCountByPackageId.get(key) ?? 0) + 1);
      }
    }

    for (const row of linkRows ?? []) {
      linkedPackageBySession.set(row.session_id as string, {
        packageId: row.student_package_id as string,
        packageName: packageNameById.get(row.student_package_id as string) ?? null,
        bySeries: (row.link_scope as string) === "series",
      });
    }

    const enrollmentByStudentAndCourse = new Map<string, { id: string; name: string | null }>();
    const enrollmentByCohortAndCourse = new Map<string, { id: string; name: string | null }>();
    for (const row of enrollmentRows ?? []) {
      if (row.student_package_id) {
        const pkg = {
          id: row.student_package_id as string,
          name: packageNameById.get(row.student_package_id as string) ?? null,
        };
        if (row.user_id) {
          enrollmentByStudentAndCourse.set(`${row.user_id}:${row.course_id}`, pkg);
        }
        if (row.cohort_id) {
          enrollmentByCohortAndCourse.set(`${row.cohort_id}:${row.course_id}`, pkg);
        }
      }
    }
    for (const session of rows) {
      if (session.student_id && session.course_id) {
        const pkg = enrollmentByStudentAndCourse.get(`${session.student_id}:${session.course_id}`);
        if (pkg) suggestedPackageBySession.set(session.id, pkg);
      } else if (session.cohort_id && session.course_id) {
        const pkg = enrollmentByCohortAndCourse.get(`${session.cohort_id}:${session.course_id}`);
        if (pkg) suggestedPackageBySession.set(session.id, pkg);
      }
    }

    for (const row of logRows ?? []) {
      logBySession.set(row.session_id as string, {
        completed: Boolean(row.completed),
        attendanceMarked: Boolean(row.attendance_marked),
        attendanceStatus:
          row.attendance_status === "present" ||
          row.attendance_status === "absent_notified" ||
          row.attendance_status === "absent_unnotified"
            ? row.attendance_status
            : null,
        homeworkMarked: Boolean(row.homework_marked),
      });
    }
  }

  return {
    schemaReady: true,
    sessions: rows.map((session) => ({
      ...session,
      studentName: session.student_id ? (studentNameById.get(session.student_id) ?? null) : null,
      cohortName: session.cohort_id ? (cohortNameById.get(session.cohort_id) ?? null) : null,
      pendingRescheduleCount: pendingCountBySession.get(session.id) ?? 0,
      linkedPackageId: linkedPackageBySession.get(session.id)?.packageId ?? null,
      linkedPackageName: linkedPackageBySession.get(session.id)?.packageName ?? null,
      linkedBySeries: linkedPackageBySession.get(session.id)?.bySeries ?? false,
      linkedLessonCountInPackage:
        linkedPackageBySession.get(session.id)?.packageId
          ? packageLinkCountByPackageId.get(linkedPackageBySession.get(session.id)!.packageId) ?? 0
          : 0,
      suggestedPackageId: suggestedPackageBySession.get(session.id)?.id ?? null,
      suggestedPackageName: suggestedPackageBySession.get(session.id)?.name ?? null,
      completed: logBySession.get(session.id)?.completed ?? false,
      attendanceMarked: logBySession.get(session.id)?.attendanceMarked ?? false,
      attendanceStatus: logBySession.get(session.id)?.attendanceStatus ?? null,
      homeworkMarked: logBySession.get(session.id)?.homeworkMarked ?? false,
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
