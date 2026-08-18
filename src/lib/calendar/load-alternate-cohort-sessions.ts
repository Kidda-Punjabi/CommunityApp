import "server-only";

import {
  isActiveCohortSwitchStatus,
  isAlternateCohortSwitchSession,
  resolveCohortSwitchWeekNumber,
} from "@/lib/calendar/cohort-switch-candidates";
import { NO_MATCHING_ALTERNATE_SESSION_COPY } from "@/lib/calendar/constants";
import type { AlternateCohortOption, ScheduledSessionRow } from "@/lib/calendar/types";
import { getDisplayName } from "@/lib/profile/display-name";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const NO_ALTERNATIVE_SESSIONS_REASON = NO_MATCHING_ALTERNATE_SESSION_COPY;

type SourceSession = Pick<
  ScheduledSessionRow,
  "id" | "course_id" | "tutor_id" | "cohort_id" | "week_number"
> & { lessonNumber?: number | null };

type CohortMeta = {
  id: string;
  name: string;
  tutor_id: string | null;
  course_id: string;
  active: boolean;
  status: string | null;
};

/**
 * Load alternate group sessions a student can request to join.
 * Uses the service role because students cannot RLS-read other cohorts' sessions.
 */
export async function loadAlternateCohortSessions(
  _supabase: SupabaseClient,
  sources: SourceSession[],
  options?: { nowMs?: number }
): Promise<Map<string, AlternateCohortOption[]>> {
  const result = new Map<string, AlternateCohortOption[]>();
  const groupSources = sources.filter(
    (session) => Boolean(session.cohort_id) && Boolean(session.course_id)
  );
  for (const source of groupSources) {
    result.set(source.id, []);
  }
  if (groupSources.length === 0) return result;

  const { client: admin, error: adminError } = tryCreateServiceRoleClient();
  if (!admin) {
    console.error("loadAlternateCohortSessions: service role unavailable:", adminError);
    return result;
  }

  const nowMs = options?.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const courseIds = [...new Set(groupSources.map((session) => session.course_id as string))];

  const [{ data: cohortRows, error: cohortError }, { data: sessionRows, error: sessionError }] =
    await Promise.all([
      admin
        .from("cohorts")
        .select("id, name, tutor_id, course_id, active, status")
        .in("course_id", courseIds)
        .eq("active", true),
      admin
        .from("tutor_scheduled_sessions")
        .select("*")
        .in("course_id", courseIds)
        .not("cohort_id", "is", null)
        .eq("status", "scheduled")
        .gte("starts_at", nowIso)
        .order("starts_at", { ascending: true }),
    ]);

  if (cohortError) {
    console.error("loadAlternateCohortSessions cohorts:", cohortError.message);
    return result;
  }
  if (sessionError) {
    console.error("loadAlternateCohortSessions sessions:", sessionError.message);
    return result;
  }

  const activeCohorts = ((cohortRows ?? []) as CohortMeta[]).filter(
    (cohort) => cohort.active && isActiveCohortSwitchStatus(cohort.status)
  );
  const cohortById = new Map(activeCohorts.map((cohort) => [cohort.id, cohort]));

  const tutorIdsToName = [
    ...new Set(
      [
        ...activeCohorts.map((cohort) => cohort.tutor_id),
        ...((sessionRows ?? []) as ScheduledSessionRow[]).map((session) => session.tutor_id),
      ].filter(Boolean)
    ),
  ] as string[];
  const { data: tutors } =
    tutorIdsToName.length > 0
      ? await admin.from("profiles").select("id, full_name, preferred_name").in("id", tutorIdsToName)
      : { data: [] };
  const tutorNameById = new Map(
    (tutors ?? []).map((tutor) => [tutor.id as string, getDisplayName(tutor) ?? "Tutor"])
  );

  const candidates = ((sessionRows ?? []) as ScheduledSessionRow[]).filter((session) => {
    if (!session.cohort_id) return false;
    const cohort = cohortById.get(session.cohort_id);
    if (!cohort) return false;
    const title = session.title.trim().toLowerCase();
    return !title.includes("meeting");
  });

  for (const source of groupSources) {
    const sourceWeek = resolveCohortSwitchWeekNumber(source);
    if (sourceWeek == null) {
      result.set(source.id, []);
      continue;
    }

    const matches = candidates.filter((candidate) =>
      isAlternateCohortSwitchSession(source, candidate, { nowMs })
    );
    const seenCohorts = new Set<string>();
    const optionsForSource: AlternateCohortOption[] = [];
    for (const candidate of matches) {
      const cohortId = candidate.cohort_id as string;
      if (seenCohorts.has(cohortId)) continue;
      seenCohorts.add(cohortId);
      const cohort = cohortById.get(cohortId);
      optionsForSource.push({
        id: candidate.id,
        cohortId,
        name: cohort?.name ?? candidate.title ?? "Alternate session",
        tutorName: tutorNameById.get(candidate.tutor_id) ?? "Tutor",
        startsAt: candidate.starts_at,
        endsAt: candidate.ends_at,
        lessonLabel: candidate.title,
      });
    }
    result.set(source.id, optionsForSource);
  }

  return result;
}

export async function loadAlternateCohortSessionsForSource(
  supabase: SupabaseClient,
  source: SourceSession,
  options?: { nowMs?: number }
): Promise<AlternateCohortOption[]> {
  const map = await loadAlternateCohortSessions(supabase, [source], options);
  return map.get(source.id) ?? [];
}
