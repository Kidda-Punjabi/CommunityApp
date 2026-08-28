import "server-only";

import type { CohortSwitchRequestStatus } from "@/lib/calendar/types";
import { formatSessionWhen } from "@/lib/calendar/reschedule-policy";
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
  toSessionId: string | null;
  toSessionStartsAt: string | null;
  toSessionEndsAt: string | null;
  toSessionWhen: string | null;
  fromTutorName: string | null;
  toTutorName: string | null;
  syncError: string | null;
  calendarSyncedAt: string | null;
};

export async function loadAdminCohortSwitchRequests(
  supabase: SupabaseClient
): Promise<{ rows: AdminCohortSwitchRequestRow[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("cohort_switch_requests")
      .select(
        "id, status, message, created_at, tutor_response, resolved_at, student_id, session_id, from_cohort_id, to_cohort_id, to_session_id, sync_error, calendar_synced_at, tutor_scheduled_sessions!session_id(id, title, starts_at, ends_at, tutor_id)"
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
              .select("id, starts_at, ends_at, tutor_id, title")
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
        },
      ])
    );
    const emailById = new Map(
      (authUsers.data?.users ?? [])
        .filter((u) => u.email)
        .map((u) => [u.id, u.email!] as const)
    );

    const rows: AdminCohortSwitchRequestRow[] = [];
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

      rows.push({
        id: row.id,
        status: row.status as CohortSwitchRequestStatus,
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
        toSessionId: (row.to_session_id as string | null) ?? null,
        toSessionStartsAt: toSession?.startsAt ?? null,
        toSessionEndsAt: toSession?.endsAt ?? null,
        toSessionWhen:
          toSession?.startsAt && toSession?.endsAt
            ? formatSessionWhen(toSession.startsAt, toSession.endsAt)
            : null,
        fromTutorName: getDisplayName(fromTutor ?? null),
        toTutorName: getDisplayName(toTutor ?? null),
        syncError: (row.sync_error as string | null) ?? null,
        calendarSyncedAt: (row.calendar_synced_at as string | null) ?? null,
      });
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
      error: e instanceof Error ? e.message : "Failed to load session switch requests.",
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
      error: e instanceof Error ? e.message : "Failed to count session switch requests.",
    };
  }
}
