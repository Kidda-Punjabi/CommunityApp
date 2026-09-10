import "server-only";

import { loadAlternateCohortSessions } from "@/lib/calendar/load-alternate-cohort-sessions";
import { formatSessionWhen } from "@/lib/calendar/reschedule-policy";
import type { AlternateCohortOption, CohortSwitchRequestStatus } from "@/lib/calendar/types";
import { getDisplayName } from "@/lib/profile/display-name";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminCohortSwitchRequestRow = {
  id: string;
  status: CohortSwitchRequestStatus;
  message: string | null;
  createdAt: string;
  tutorResponse: string | null;
  resolvedAt: string | null;
  studentId: string;
  studentName: string;
  studentEmail: string | null;
  fromCohortId: string;
  fromCohortName: string;
  toCohortId: string;
  toCohortName: string;
  sessionId: string;
  sessionTitle: string;
  sessionStartsAt: string;
  sessionEndsAt: string;
  sessionWhen: string;
  fromWeekNumber: number | null;
  toSessionId: string | null;
  toSessionStartsAt: string | null;
  toSessionEndsAt: string | null;
  toSessionWhen: string | null;
  toWeekNumber: number | null;
  fromTutorName: string | null;
  toTutorName: string | null;
  /** Other valid switch candidates from the same function students see, excluding the requested session. */
  alternateCandidates: AlternateCohortOption[];
  /** Whether `to_session_id` is still in that student-facing candidate list. */
  requestedIsCurrentCandidate: boolean;
};

function asWeekNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export async function loadAdminCohortSwitchRequests(
  supabase: SupabaseClient
): Promise<{ rows: AdminCohortSwitchRequestRow[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("cohort_switch_requests")
      .select(
        "id, status, message, created_at, tutor_response, resolved_at, student_id, session_id, from_cohort_id, to_cohort_id, to_session_id, tutor_scheduled_sessions!session_id(id, title, starts_at, ends_at, tutor_id, week_number, course_id, cohort_id)"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) return { rows: [], error: error.message };

    const rowsRaw = data ?? [];
    const studentIds = [...new Set(rowsRaw.map((r) => r.student_id))];
    const cohortIds = [
      ...new Set(
        rowsRaw.flatMap((r) => [r.from_cohort_id, r.to_cohort_id]).filter(Boolean)
      ),
    ] as string[];
    const toSessionIds = [
      ...new Set(
        rowsRaw.map((r) => r.to_session_id as string | null).filter((id): id is string => Boolean(id))
      ),
    ];
    const fromTutorIds = [
      ...new Set(
        rowsRaw
          .map((r) => {
            const session = Array.isArray(r.tutor_scheduled_sessions)
              ? r.tutor_scheduled_sessions[0]
              : r.tutor_scheduled_sessions;
            return session?.tutor_id as string | undefined;
          })
          .filter(Boolean)
      ),
    ] as string[];

    const [{ data: profiles }, { data: cohorts }, { data: toSessions }, authUsers] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, preferred_name")
          .in("id", [...new Set([...studentIds, ...fromTutorIds])]),
        cohortIds.length > 0
          ? supabase.from("cohorts").select("id, name, tutor_id").in("id", cohortIds)
          : Promise.resolve({ data: [] }),
        toSessionIds.length > 0
          ? supabase
              .from("tutor_scheduled_sessions")
              .select("id, starts_at, ends_at, tutor_id, title, week_number")
              .in("id", toSessionIds)
          : Promise.resolve({ data: [] }),
        supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      ]);

    const toTutorIds = [
      ...new Set(
        [
          ...(cohorts ?? []).map((c) => c.tutor_id as string | null),
          ...(toSessions ?? []).map((s) => s.tutor_id as string | null),
        ].filter((id): id is string => Boolean(id))
      ),
    ];
    const missingTutorIds = toTutorIds.filter(
      (id) => !(profiles ?? []).some((p) => p.id === id)
    );
    const { data: extraTutors } =
      missingTutorIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, full_name, preferred_name")
            .in("id", missingTutorIds)
        : { data: [] };

    const profileById = new Map(
      [...(profiles ?? []), ...(extraTutors ?? [])].map((p) => [p.id, p])
    );
    const cohortById = new Map(
      (cohorts ?? []).map((c) => [
        c.id as string,
        { name: c.name as string, tutorId: (c.tutor_id as string | null) ?? null },
      ])
    );
    const toSessionById = new Map(
      (toSessions ?? []).map((s) => [
        s.id as string,
        {
          startsAt: s.starts_at as string,
          endsAt: s.ends_at as string,
          tutorId: s.tutor_id as string,
          title: s.title as string,
          weekNumber: asWeekNumber(s.week_number),
        },
      ])
    );
    const emailById = new Map(
      (authUsers.data?.users ?? [])
        .filter((u) => u.email)
        .map((u) => [u.id, u.email!] as const)
    );

    const rows: AdminCohortSwitchRequestRow[] = [];
    const pendingSources: Array<{
      id: string;
      course_id: string;
      tutor_id: string;
      cohort_id: string;
      week_number: number | null;
    }> = [];
    const pendingSourceIds = new Set<string>();

    for (const row of rowsRaw) {
      const session = Array.isArray(row.tutor_scheduled_sessions)
        ? row.tutor_scheduled_sessions[0]
        : row.tutor_scheduled_sessions;
      if (!session) continue;

      const toSession = row.to_session_id
        ? toSessionById.get(row.to_session_id as string)
        : undefined;
      const fromCohort = cohortById.get(row.from_cohort_id);
      const toCohort = cohortById.get(row.to_cohort_id);
      const student = profileById.get(row.student_id);
      const fromTutor = profileById.get(session.tutor_id);
      const toTutorId = toSession?.tutorId ?? toCohort?.tutorId ?? null;
      const toTutor = toTutorId ? profileById.get(toTutorId) : null;
      const fromWeekNumber = asWeekNumber(session.week_number);
      const courseId = (session.course_id as string | null) ?? null;
      const sourceCohortId =
        (session.cohort_id as string | null) ?? (row.from_cohort_id as string | null);
      const status = row.status as CohortSwitchRequestStatus;

      if (
        status === "pending" &&
        courseId &&
        sourceCohortId &&
        !pendingSourceIds.has(session.id as string)
      ) {
        pendingSourceIds.add(session.id as string);
        pendingSources.push({
          id: session.id as string,
          course_id: courseId,
          tutor_id: session.tutor_id as string,
          cohort_id: sourceCohortId,
          week_number: fromWeekNumber,
        });
      }

      rows.push({
        id: row.id,
        status,
        message: row.message,
        createdAt: row.created_at,
        tutorResponse: row.tutor_response,
        resolvedAt: row.resolved_at,
        studentId: row.student_id,
        studentName: getDisplayName(student ?? null) ?? "Student",
        studentEmail: emailById.get(row.student_id) ?? null,
        fromCohortId: row.from_cohort_id,
        fromCohortName: fromCohort?.name ?? "Current cohort",
        toCohortId: row.to_cohort_id,
        toCohortName: toCohort?.name ?? "Alternate cohort",
        sessionId: session.id,
        sessionTitle: session.title,
        sessionStartsAt: session.starts_at,
        sessionEndsAt: session.ends_at,
        sessionWhen: formatSessionWhen(session.starts_at, session.ends_at),
        fromWeekNumber,
        toSessionId: (row.to_session_id as string | null) ?? null,
        toSessionStartsAt: toSession?.startsAt ?? null,
        toSessionEndsAt: toSession?.endsAt ?? null,
        toSessionWhen:
          toSession?.startsAt && toSession?.endsAt
            ? formatSessionWhen(toSession.startsAt, toSession.endsAt)
            : null,
        toWeekNumber: toSession?.weekNumber ?? null,
        fromTutorName: getDisplayName(fromTutor ?? null),
        toTutorName: getDisplayName(toTutor ?? null),
        alternateCandidates: [],
        requestedIsCurrentCandidate: false,
      });
    }

    const alternateBySourceId = await loadAlternateCohortSessions(supabase, pendingSources);
    for (const row of rows) {
      if (row.status !== "pending") continue;
      const all = alternateBySourceId.get(row.sessionId) ?? [];
      row.alternateCandidates = all.filter((candidate) => candidate.id !== row.toSessionId);
      row.requestedIsCurrentCandidate = row.toSessionId
        ? all.some((candidate) => candidate.id === row.toSessionId)
        : false;
    }

    rows.sort((a, b) => {
      const aPending = a.status === "pending" ? 0 : 1;
      const bPending = b.status === "pending" ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      return b.createdAt.localeCompare(a.createdAt);
    });

    return { rows };
  } catch (e) {
    return {
      rows: [],
      error: e instanceof Error ? e.message : "Failed to load cohort change requests.",
    };
  }
}

export async function countPendingCohortSwitchRequests(
  supabase: SupabaseClient
): Promise<{ count: number; error?: string }> {
  try {
    const { count, error } = await supabase
      .from("cohort_switch_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    if (error) return { count: 0, error: error.message };
    return { count: count ?? 0 };
  } catch (e) {
    return {
      count: 0,
      error: e instanceof Error ? e.message : "Failed to count cohort change requests.",
    };
  }
}

export async function loadPendingCohortSwitchRequestCreatedAts(
  supabase: SupabaseClient
): Promise<{ createdAts: string[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("cohort_switch_requests")
      .select("created_at")
      .eq("status", "pending");

    if (error) return { createdAts: [], error: error.message };
    return {
      createdAts: (data ?? []).map((row) => row.created_at as string),
    };
  } catch (e) {
    return {
      createdAts: [],
      error: e instanceof Error ? e.message : "Failed to load pending cohort change requests.",
    };
  }
}
