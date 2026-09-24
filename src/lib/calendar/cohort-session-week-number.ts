import { sessionWeekNumberIsFrozen } from "./lesson-assignment";
import { isCountableLessonLogStatus } from "@/lib/lessons/lesson-log-progress";
import type { ScheduledSessionRow } from "@/lib/calendar/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Sessions closer than this are treated as duplicate/rescheduled (ambiguous week). */
const MIN_CLASS_SESSION_GAP_MS = 4 * 24 * 60 * 60 * 1000;

export type CohortSessionWeekInput = Pick<
  ScheduledSessionRow,
  "id" | "cohort_id" | "starts_at" | "title" | "status" | "match_method"
>;

export type CohortClassSessionMatchInput = {
  cohort_id: string | null;
  title: string;
  status: string | null;
  match_method: string | null;
};

/** Distinct titles of non-cancelled manual or calendar_link rows, per cohort. */
export function cohortAnchorTitlesByCohort(
  sessions: CohortClassSessionMatchInput[]
): Map<string, Set<string>> {
  const byCohort = new Map<string, Set<string>>();
  for (const session of sessions) {
    if (!session.cohort_id) continue;
    if (session.status === "cancelled") continue;
    if (session.match_method !== "manual" && session.match_method !== "calendar_link") continue;
    const title = session.title.trim();
    if (!title) continue;
    const titles = byCohort.get(session.cohort_id) ?? new Set<string>();
    titles.add(title);
    byCohort.set(session.cohort_id, titles);
  }
  return byCohort;
}

export function isCohortClassSession(
  session: CohortClassSessionMatchInput,
  anchorTitles?: ReadonlySet<string>
): boolean {
  if (!session.cohort_id) return false;
  if (session.status === "cancelled") return false;
  if (session.match_method === "unmatched" || session.match_method === "title_name") return false;

  const title = session.title.trim().toLowerCase();
  if (title.includes("meeting")) return false;
  if (title.includes("class") || title.includes("cohort")) return true;
  return anchorTitles?.has(session.title.trim()) ?? false;
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
  const anchorTitlesByCohort = cohortAnchorTitlesByCohort(sessions);

  const byCohort = new Map<string, CohortSessionWeekInput[]>();
  for (const session of sessions) {
    if (
      !session.cohort_id ||
      !isCohortClassSession(session, anchorTitlesByCohort.get(session.cohort_id))
    ) {
      continue;
    }
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
    .select("id, cohort_id, starts_at, title, status, match_method, lesson_id, week_number")
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

  const loadedSessions = (sessions ?? []) as Array<
    CohortSessionWeekInput & { lesson_id?: string | null; week_number?: number | null }
  >;
  const anchorTitlesByCohort = cohortAnchorTitlesByCohort(loadedSessions);
  const classSessionIds = new Set(
    loadedSessions
      .filter((session) =>
        isCohortClassSession(
          session,
          session.cohort_id ? anchorTitlesByCohort.get(session.cohort_id) : undefined
        )
      )
      .map((session) => session.id)
  );

  const ambiguousSessionIds: string[] = [];
  let updated = 0;

  const frozenSessionIds = new Set(
    loadedSessions.filter((session) => sessionWeekNumberIsFrozen(session)).map((session) => session.id)
  );

  await Promise.all(
    [...classSessionIds].map(async (sessionId) => {
      if (frozenSessionIds.has(sessionId)) return;
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
