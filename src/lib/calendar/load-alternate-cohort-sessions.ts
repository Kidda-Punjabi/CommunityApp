import "server-only";

import {
  isActiveCohortSwitchStatus,
  isSessionSwitchCandidate,
} from "@/lib/calendar/cohort-switch-candidates";
import { KIDDA_CLASS_TITLE_NEEDLE, NO_MATCHING_ALTERNATE_SESSION_COPY, SESSION_SWITCH_WINDOW_DAYS } from "@/lib/calendar/constants";
import type { AlternateCohortOption, ScheduledSessionRow } from "@/lib/calendar/types";
import { getDisplayName } from "@/lib/profile/display-name";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const NO_ALTERNATIVE_SESSIONS_REASON = NO_MATCHING_ALTERNATE_SESSION_COPY;

type SourceSession = Pick<
  ScheduledSessionRow,
  "id" | "course_id" | "tutor_id" | "cohort_id" | "starts_at"
>;

type CohortMeta = {
  id: string;
  name: string;
  tutor_id: string | null;
  course_id: string;
  active: boolean;
  status: string | null;
};

function windowBoundsIso(sources: SourceSession[]): { minIso: string; maxIso: string } | null {
  if (sources.length === 0) return null;
  const dayMs = SESSION_SWITCH_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  let minMs = Number.POSITIVE_INFINITY;
  let maxMs = Number.NEGATIVE_INFINITY;
  for (const source of sources) {
    const refMs = new Date(source.starts_at).getTime();
    if (Number.isNaN(refMs)) continue;
    minMs = Math.min(minMs, refMs - dayMs);
    maxMs = Math.max(maxMs, refMs + dayMs);
  }
  if (!Number.isFinite(minMs) || !Number.isFinite(maxMs)) return null;
  return { minIso: new Date(minMs).toISOString(), maxIso: new Date(maxMs).toISOString() };
}

/**
 * Load other cohorts' Kidda Class sessions a student can switch into for one week.
 * Uses the service role because students cannot RLS-read other cohorts' sessions.
 * Matches on date proximity to the source session (not week_number).
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
  const bounds = windowBoundsIso(groupSources);
  if (!bounds) return result;

  const rangeStart = bounds.minIso < nowIso ? nowIso : bounds.minIso;

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
        .ilike("title", `%${KIDDA_CLASS_TITLE_NEEDLE}%`)
        .gte("starts_at", rangeStart)
        .lte("starts_at", bounds.maxIso)
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
    return Boolean(cohortById.get(session.cohort_id));
  });

  for (const source of groupSources) {
    const matches = candidates.filter((candidate) =>
      isSessionSwitchCandidate(source, candidate, { nowMs })
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
        name: cohort?.name ?? candidate.title ?? "Other class",
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
