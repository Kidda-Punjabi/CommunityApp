import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isClassMatchedSession,
  planTutorLessonLog,
  type LessonLogSessionCandidate,
  type PlannedTutorLessonLog,
} from "@/lib/tutoring/lesson-log-session";

type SessionRow = {
  id: string;
  google_event_id: string | null;
  starts_at: string;
  event_timezone: string | null;
  cohort_id: string | null;
  student_id: string | null;
  course_id: string | null;
  match_method: string | null;
  status: string | null;
};

function toCandidate(
  row: SessionRow,
  packageInstanceId: string | null
): LessonLogSessionCandidate | null {
  if (!row.google_event_id || !row.starts_at) return null;
  return {
    id: row.id,
    googleEventId: row.google_event_id,
    startsAt: row.starts_at,
    eventTimeZone: row.event_timezone,
    cohortId: packageInstanceId ? null : row.cohort_id,
    packageInstanceId,
    matchMethod: row.match_method,
    status: row.status,
  };
}

async function loadCohortSessions(
  admin: SupabaseClient,
  cohortId: string
): Promise<LessonLogSessionCandidate[]> {
  const { data, error } = await admin
    .from("tutor_scheduled_sessions")
    .select(
      "id, google_event_id, starts_at, event_timezone, cohort_id, student_id, course_id, match_method, status"
    )
    .eq("cohort_id", cohortId)
    .neq("status", "cancelled");
  if (error) throw new Error(error.message);
  return ((data ?? []) as SessionRow[])
    .map((row) => toCandidate(row, null))
    .filter((row): row is LessonLogSessionCandidate => row !== null)
    .filter((row) => isClassMatchedSession(row));
}

async function loadPackageSessions(
  admin: SupabaseClient,
  packageInstanceId: string
): Promise<LessonLogSessionCandidate[]> {
  const { data: instance, error: instanceError } = await admin
    .from("package_instances")
    .select("id, course_id")
    .eq("id", packageInstanceId)
    .maybeSingle();
  if (instanceError) throw new Error(instanceError.message);
  if (!instance) return [];

  const { data: links, error: linkError } = await admin
    .from("student_packages")
    .select("user_id")
    .eq("package_instance_id", packageInstanceId)
    .neq("status", "withdrawn");
  if (linkError) throw new Error(linkError.message);
  const studentIds = [
    ...new Set((links ?? []).map((row) => row.user_id as string).filter(Boolean)),
  ];
  if (studentIds.length === 0) return [];

  const { data, error } = await admin
    .from("tutor_scheduled_sessions")
    .select(
      "id, google_event_id, starts_at, event_timezone, cohort_id, student_id, course_id, match_method, status"
    )
    .in("student_id", studentIds)
    .is("cohort_id", null)
    .neq("status", "cancelled");
  if (error) throw new Error(error.message);

  const courseId = (instance.course_id as string | null) ?? null;
  return ((data ?? []) as SessionRow[])
    .filter((row) => !courseId || !row.course_id || row.course_id === courseId)
    .map((row) => toCandidate(row, packageInstanceId))
    .filter((row): row is LessonLogSessionCandidate => row !== null)
    .filter((row) => isClassMatchedSession(row));
}

export async function loadClassSessionsForLessonLog(
  admin: SupabaseClient,
  input: { cohortId: string | null; packageInstanceId: string | null }
): Promise<LessonLogSessionCandidate[]> {
  if (input.cohortId) return loadCohortSessions(admin, input.cohortId);
  if (input.packageInstanceId) return loadPackageSessions(admin, input.packageInstanceId);
  return [];
}

export async function findOpenLessonLogForSession(
  admin: SupabaseClient,
  input: {
    cohortId: string | null;
    packageInstanceId: string | null;
    googleEventIds: string[];
    sessionStartsAt: string | null;
    lessonDate: string;
  }
): Promise<{ id: string } | null> {
  const open = admin
    .from("cohort_lesson_log_entries")
    .select("id")
    .is("dismissed_at", null)
    .order("created_at", { ascending: true })
    .limit(1);

  if (input.googleEventIds.length > 0) {
    const { data, error } = await open.in("google_event_id", input.googleEventIds).maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.id) return { id: data.id as string };
  }

  if (input.sessionStartsAt && input.cohortId) {
    const { data, error } = await admin
      .from("cohort_lesson_log_entries")
      .select("id")
      .is("dismissed_at", null)
      .eq("cohort_id", input.cohortId)
      .eq("session_starts_at", input.sessionStartsAt)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.id) return { id: data.id as string };
  }

  if (input.sessionStartsAt && input.packageInstanceId) {
    const { data, error } = await admin
      .from("cohort_lesson_log_entries")
      .select("id")
      .is("dismissed_at", null)
      .eq("package_instance_id", input.packageInstanceId)
      .eq("session_starts_at", input.sessionStartsAt)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.id) return { id: data.id as string };
  }

  let legacy = admin
    .from("cohort_lesson_log_entries")
    .select("id")
    .is("dismissed_at", null)
    .is("google_event_id", null)
    .is("session_starts_at", null)
    .eq("lesson_date", input.lessonDate)
    .order("created_at", { ascending: true })
    .limit(2);
  if (input.cohortId) legacy = legacy.eq("cohort_id", input.cohortId);
  else if (input.packageInstanceId) legacy = legacy.eq("package_instance_id", input.packageInstanceId);
  else return null;
  const { data: legacyRows, error: legacyError } = await legacy;
  if (legacyError) throw new Error(legacyError.message);
  const rows = legacyRows ?? [];
  if (input.sessionStartsAt) {
    if (rows.length === 1 && rows[0]?.id) return { id: rows[0].id as string };
    return null;
  }
  if (rows[0]?.id) return { id: rows[0].id as string };
  return null;
}

export async function planTutorLessonLogForTarget(
  admin: SupabaseClient,
  input: {
    now?: Date;
    typedDate: string;
    cohortId: string | null;
    packageInstanceId: string | null;
    isAdmin: boolean;
    earlyOverrideReason: string | null;
    earlyOverrideBy: string | null;
  }
): Promise<PlannedTutorLessonLog> {
  const sessions = await loadClassSessionsForLessonLog(admin, {
    cohortId: input.cohortId,
    packageInstanceId: input.packageInstanceId,
  });
  return planTutorLessonLog({
    now: input.now ?? new Date(),
    typedDate: input.typedDate,
    sessions,
    isAdmin: input.isAdmin,
    earlyOverrideReason: input.earlyOverrideReason,
    earlyOverrideBy: input.earlyOverrideBy,
  });
}
