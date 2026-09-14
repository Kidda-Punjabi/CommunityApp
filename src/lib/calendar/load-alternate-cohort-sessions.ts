import "server-only";

import {
  isActiveCohortSwitchStatus,
  isAlternateCohortSwitchSession,
  resolveCohortSwitchWeekNumber,
} from "@/lib/calendar/cohort-switch-candidates";
import { NO_MATCHING_ALTERNATE_SESSION_COPY } from "@/lib/calendar/constants";
import { kidsCohortsShareAgeGroup } from "@/lib/calendar/kids-cohort-age-group";
import { KIDS_CONTENT_TRACK } from "@/lib/learning/kids-courses";
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
  start_date: string | null;
  age_group: string | null;
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

  const [
    { data: cohortRows, error: cohortError },
    { data: sessionRows, error: sessionError },
    { data: courseRows, error: courseError },
  ] = await Promise.all([
    admin
      .from("cohorts")
      .select("id, name, tutor_id, course_id, active, status, start_date, age_group")
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
    admin.from("courses").select("id, content_track").in("id", courseIds),
  ]);

  if (cohortError) {
    console.error("loadAlternateCohortSessions cohorts:", cohortError.message);
    return result;
  }
  if (sessionError) {
    console.error("loadAlternateCohortSessions sessions:", sessionError.message);
    return result;
  }
  if (courseError) {
    console.error("loadAlternateCohortSessions courses:", courseError.message);
    return result;
  }

  const kidsCourseIds = new Set(
    (courseRows ?? [])
      .filter((course) => course.content_track === KIDS_CONTENT_TRACK)
      .map((course) => course.id as string)
  );

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

    const sourceCohort = source.cohort_id ? cohortById.get(source.cohort_id) : undefined;
    const restrictKidsAgeGroup = Boolean(
      source.course_id && kidsCourseIds.has(source.course_id)
    );

    const matches = candidates.filter((candidate) => {
      if (!isAlternateCohortSwitchSession(source, candidate, { nowMs })) return false;
      if (!restrictKidsAgeGroup) return true;
      const candidateCohort = candidate.cohort_id
        ? cohortById.get(candidate.cohort_id)
        : undefined;
      return kidsCohortsShareAgeGroup(
        sourceCohort?.age_group,
        candidateCohort?.age_group
      );
    });
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
        startDate: cohort?.start_date ?? null,
        weekNumber: candidate.week_number ?? null,
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
