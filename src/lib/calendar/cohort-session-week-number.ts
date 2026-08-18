import { isCountableLessonLogStatus } from "@/lib/lessons/lesson-log-progress";
import type { ScheduledSessionRow } from "@/lib/calendar/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Sessions closer than this are treated as duplicate/rescheduled (ambiguous week). */
const MIN_CLASS_SESSION_GAP_MS = 4 * 24 * 60 * 60 * 1000;

export type CohortSessionWeekInput = Pick<
  ScheduledSessionRow,
  "id" | "cohort_id" | "starts_at" | "title" | "status" | "match_method"
>;

export function isCohortClassSession(session: CohortSessionWeekInput): boolean {
  if (!session.cohort_id) return false;
  if (session.status === "cancelled") return false;
  if (session.match_method === "unmatched" || session.match_method === "title_name") return false;

  const title = session.title.trim().toLowerCase();
  if (title.includes("meeting")) return false;
  return title.includes("class") || title.includes("cohort");
}

/**
 * Derive curriculum week numbers aligned with session-lesson-labels:
 * completed countable logs = N → next upcoming class session is week N+1.
 */
export function computeCohortSessionWeekNumbers(
  sessions: CohortSessionWeekInput[],
  completedCountByCohort: Map<string, number>,
  options?: { nowMs?: number }
): Map<string, number | null> {
  const nowMs = options?.nowMs ?? Date.now();
  const weekNumberBySessionId = new Map<string, number | null>();

  const byCohort = new Map<string, CohortSessionWeekInput[]>();
  for (const session of sessions) {
    if (!session.cohort_id || !isCohortClassSession(session)) continue;
    const list = byCohort.get(session.cohort_id) ?? [];
    list.push(session);
    byCohort.set(session.cohort_id, list);
  }

  for (const [cohortId, cohortSessions] of byCohort) {
    const sorted = [...cohortSessions].sort(
      (a, b) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime() ||
        a.id.localeCompare(b.id)
    );

    const completedCount = completedCountByCohort.get(cohortId) ?? 0;
    const ambiguousIds = new Set<string>();

    for (let index = 0; index < sorted.length; index += 1) {
      if (index === 0) continue;
      const gapMs =
        new Date(sorted[index].starts_at).getTime() -
        new Date(sorted[index - 1].starts_at).getTime();
      if (gapMs < MIN_CLASS_SESSION_GAP_MS) {
        ambiguousIds.add(sorted[index].id);
      }
    }

    const upcoming = sorted.filter(
      (session) => new Date(session.starts_at).getTime() >= nowMs
    );

    for (let index = 0; index < upcoming.length; index += 1) {
      const session = upcoming[index];
      weekNumberBySessionId.set(
        session.id,
        ambiguousIds.has(session.id) ? null : completedCount + index + 1
      );
    }

    const past = sorted.filter((session) => new Date(session.starts_at).getTime() < nowMs);
    for (let index = 0; index < past.length; index += 1) {
      const session = past[index];
      if (ambiguousIds.has(session.id)) {
        weekNumberBySessionId.set(session.id, null);
        continue;
      }
      const weekNumber = index + 1;
      weekNumberBySessionId.set(session.id, weekNumber <= completedCount ? weekNumber : null);
    }
  }

  return weekNumberBySessionId;
}

async function loadCompletedCountByCohort(
  adminClient: SupabaseClient,
  cohortIds: string[]
): Promise<Map<string, number>> {
  const completedByCohort = new Map<string, number>();
  if (cohortIds.length === 0) return completedByCohort;

  const { data, error } = await adminClient
    .from("cohort_lesson_log_entries")
    .select("cohort_id, status")
    .in("cohort_id", cohortIds);

  if (error) throw error;

  for (const row of data ?? []) {
    if (!row.cohort_id) continue;
    if (!isCountableLessonLogStatus(row.status as string | null)) continue;
    completedByCohort.set(
      row.cohort_id,
      (completedByCohort.get(row.cohort_id) ?? 0) + 1
    );
  }

  return completedByCohort;
}

/** Recompute and persist week_number for cohort class sessions. */
export async function refreshCohortSessionWeekNumbers(
  adminClient: SupabaseClient,
  cohortIds: string[],
  options?: { nowMs?: number }
): Promise<{ updated: number; ambiguousSessionIds: string[] }> {
  const uniqueCohortIds = [...new Set(cohortIds.filter(Boolean))];
  if (uniqueCohortIds.length === 0) {
    return { updated: 0, ambiguousSessionIds: [] };
  }

  const { data: sessions, error: sessionsError } = await adminClient
    .from("tutor_scheduled_sessions")
    .select("id, cohort_id, starts_at, title, status, match_method")
    .in("cohort_id", uniqueCohortIds)
    .neq("status", "cancelled");

  if (sessionsError) throw sessionsError;

  const completedCountByCohort = await loadCompletedCountByCohort(
    adminClient,
    uniqueCohortIds
  );
  const weekNumberBySessionId = computeCohortSessionWeekNumbers(
    (sessions ?? []) as CohortSessionWeekInput[],
    completedCountByCohort,
    options
  );

  const classSessionIds = new Set(
    ((sessions ?? []) as CohortSessionWeekInput[])
      .filter(isCohortClassSession)
      .map((session) => session.id)
  );

  const ambiguousSessionIds: string[] = [];
  let updated = 0;

  await Promise.all(
    [...classSessionIds].map(async (sessionId) => {
      const weekNumber = weekNumberBySessionId.get(sessionId) ?? null;
      if (weekNumber == null) ambiguousSessionIds.push(sessionId);
      const { error } = await adminClient
        .from("tutor_scheduled_sessions")
        .update({ week_number: weekNumber })
        .eq("id", sessionId);
      if (error) throw error;
      updated += 1;
    })
  );

  return { updated, ambiguousSessionIds };
}
