import "server-only";

import { cache } from "react";
import {
  collectPages,
  evaluateCohortOpsIssues,
  isLiveCohortStatus,
  isTestCohortName,
  type CohortOpsCohort,
  type CohortOpsIssue,
  type CohortOpsSession,
} from "@/lib/admin/dashboard/cohort-ops-issues";
import { getStaffFacingName } from "@/lib/profile/display-name";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CohortOpsIssuesResult = {
  issues: CohortOpsIssue[];
  error?: string;
};

async function loadCohortOpsIssuesUncached(
  supabase: SupabaseClient
): Promise<CohortOpsIssuesResult> {
  try {
    const cohortRows = await collectPages(async (from, to) => {
      const { data, error } = await supabase
        .from("cohorts")
        .select("id, name, status, tutor_id, start_date")
        .order("id", { ascending: true })
        .range(from, to);
      if (error) throw new Error(error.message);
      return data ?? [];
    });

    const cohorts: CohortOpsCohort[] = cohortRows.map((row) => ({
      id: row.id as string,
      name: (row.name as string | null) ?? "",
      status: (row.status as string | null) ?? "",
      tutorId: (row.tutor_id as string | null) ?? null,
      startDate: (row.start_date as string | null) ?? null,
    }));

    const scopedIds = cohorts
      .filter((row) => isLiveCohortStatus(row.status) && !isTestCohortName(row.name))
      .map((row) => row.id);

    const sessions = await fetchSessionsForCohorts(supabase, scopedIds);

    const sessionRows: CohortOpsSession[] = sessions.map((row) => ({
      id: row.id as string,
      cohortId: row.cohort_id as string,
      title: (row.title as string | null) ?? "",
      startsAt: row.starts_at as string,
      status: (row.status as string | null) ?? "",
      weekNumber: (row.week_number as number | null) ?? null,
      googleRecurringEventId: (row.google_recurring_event_id as string | null) ?? null,
    }));

    const scopedIdSet = new Set(scopedIds);
    const tutorIds = [
      ...new Set(
        cohorts
          .filter((row) => scopedIdSet.has(row.id) && row.tutorId)
          .map((row) => row.tutorId as string)
      ),
    ];
    const profiles =
      tutorIds.length === 0
        ? []
        : await collectPages(async (from, to) => {
            const { data, error } = await supabase
              .from("profiles")
              .select("id, full_name, preferred_name")
              .in("id", tutorIds)
              .order("id", { ascending: true })
              .range(from, to);
            if (error) throw new Error(error.message);
            return data ?? [];
          });

    const connections =
      tutorIds.length === 0
        ? []
        : await collectPages(async (from, to) => {
            const { data, error } = await supabase
              .from("tutor_google_calendar_connections")
              .select("tutor_id")
              .in("tutor_id", tutorIds)
              .order("tutor_id", { ascending: true })
              .range(from, to);
            if (error) throw new Error(error.message);
            return data ?? [];
          });

    const liveIds = new Set(scopedIds);
    const memberRows = await fetchActiveMembers(supabase, scopedIds);

    const activeMemberCountByCohortId = new Map<string, number>();
    for (const row of memberRows) {
      const cohortId = row.cohort_id as string;
      if (!liveIds.has(cohortId)) continue;
      activeMemberCountByCohortId.set(cohortId, (activeMemberCountByCohortId.get(cohortId) ?? 0) + 1);
    }

    const tutorNameById = new Map<string, string | null>();
    for (const profile of profiles) {
      tutorNameById.set(
        profile.id as string,
        getStaffFacingName({
          full_name: profile.full_name as string | null,
          preferred_name: profile.preferred_name as string | null,
        })
      );
    }

    return {
      issues: evaluateCohortOpsIssues({
        cohorts,
        cohortNames: cohorts.map((row) => ({ id: row.id, name: row.name })),
        sessions: sessionRows,
        activeMemberCountByCohortId,
        tutorNameById,
        connectedTutorIds: new Set(connections.map((row) => row.tutor_id as string)),
      }),
    };
  } catch (error) {
    return {
      issues: [],
      error: error instanceof Error ? error.message : "Could not load cohort issues.",
    };
  }
}

const ID_CHUNK = 40;

async function fetchSessionsForCohorts(supabase: SupabaseClient, cohortIds: string[]) {
  const rows: Array<{
    id: string;
    cohort_id: string;
    title: string | null;
    starts_at: string;
    status: string | null;
    week_number: number | null;
    google_recurring_event_id: string | null;
  }> = [];
  for (let index = 0; index < cohortIds.length; index += ID_CHUNK) {
    const chunk = cohortIds.slice(index, index + ID_CHUNK);
    const page = await collectPages(async (from, to) => {
      const { data, error } = await supabase
        .from("tutor_scheduled_sessions")
        .select("id, cohort_id, title, starts_at, status, week_number, google_recurring_event_id")
        .in("cohort_id", chunk)
        .order("id", { ascending: true })
        .range(from, to);
      if (error) throw new Error(error.message);
      return data ?? [];
    });
    rows.push(...page);
  }
  return rows;
}

async function fetchActiveMembers(supabase: SupabaseClient, cohortIds: string[]) {
  const rows: Array<{ cohort_id: string; user_id: string }> = [];
  for (let index = 0; index < cohortIds.length; index += ID_CHUNK) {
    const chunk = cohortIds.slice(index, index + ID_CHUNK);
    const page = await collectPages(async (from, to) => {
      const { data, error } = await supabase
        .from("cohort_members")
        .select("cohort_id, user_id")
        .in("cohort_id", chunk)
        .is("left_at", null)
        .order("cohort_id", { ascending: true })
        .order("user_id", { ascending: true })
        .range(from, to);
      if (error) throw new Error(error.message);
      return data ?? [];
    });
    rows.push(...page);
  }
  return rows;
}

export const loadCohortOpsIssues = cache(loadCohortOpsIssuesUncached);
