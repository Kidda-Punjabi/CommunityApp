import "server-only";

import { cache } from "react";
import { notionPageHref } from "@/lib/admin/enrollment-gaps-types";
import {
  collectPages,
  evaluateCohortOpsIssues,
  isTestCohortName,
  isWeekIntegrityStatus,
  type CohortOpsCohort,
  type CohortOpsIssue,
  type CohortOpsSession,
  type DuplicateLessonLogGroup,
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
      .filter((row) => isWeekIntegrityStatus(row.status) && !isTestCohortName(row.name))
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
      matchMethod: (row.match_method as string | null) ?? null,
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

    const [acknowledgedWeekGapKeys, duplicateLogGroups] = await Promise.all([
      fetchAcknowledgedWeekGaps(supabase),
      fetchDuplicateLessonLogs(supabase),
    ]);

    return {
      issues: evaluateCohortOpsIssues({
        cohorts,
        cohortNames: cohorts.map((row) => ({ id: row.id, name: row.name })),
        sessions: sessionRows,
        activeMemberCountByCohortId,
        tutorNameById,
        connectedTutorIds: new Set(connections.map((row) => row.tutor_id as string)),
        acknowledgedWeekGapKeys,
        duplicateLogGroups,
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
    match_method: string | null;
  }> = [];
  for (let index = 0; index < cohortIds.length; index += ID_CHUNK) {
    const chunk = cohortIds.slice(index, index + ID_CHUNK);
    const page = await collectPages(async (from, to) => {
      const { data, error } = await supabase
        .from("tutor_scheduled_sessions")
        .select(
          "id, cohort_id, title, starts_at, status, week_number, google_recurring_event_id, match_method"
        )
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

async function fetchAcknowledgedWeekGaps(
  supabase: SupabaseClient
): Promise<Map<string, Set<string>>> {
  const acknowledged = new Map<string, Set<string>>();
  const { data, error } = await supabase
    .from("cohort_week_gap_acknowledgements")
    .select("cohort_id, gap_key");
  if (error) {
    if (error.message.toLowerCase().includes("cohort_week_gap_acknowledgements")) return acknowledged;
    throw new Error(error.message);
  }
  for (const row of data ?? []) {
    const cohortId = row.cohort_id as string;
    const keys = acknowledged.get(cohortId) ?? new Set<string>();
    keys.add(row.gap_key as string);
    acknowledged.set(cohortId, keys);
  }
  return acknowledged;
}

async function fetchDuplicateLessonLogs(
  supabase: SupabaseClient
): Promise<DuplicateLessonLogGroup[]> {
  const rows = await collectPages(async (from, to) => {
    const { data, error } = await supabase
      .from("cohort_lesson_log_entries")
      .select(
        "id, cohort_id, lesson_date, lesson_title, status, lesson_id, recording_url, source, notion_page_id"
      )
      .not("cohort_id", "is", null)
      .is("dismissed_at", null)
      .order("id", { ascending: true })
      .range(from, to);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = `${row.cohort_id as string}|${String(row.lesson_date).slice(0, 10)}`;
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }

  const duplicateRows = [...grouped.values()].filter((list) => list.length > 1);
  const lessonIds = [
    ...new Set(
      duplicateRows.flat().map((row) => row.lesson_id as string | null).filter((id): id is string => Boolean(id))
    ),
  ];
  const lessonLabelById = new Map<string, string>();
  if (lessonIds.length > 0) {
    const { data: lessons, error } = await supabase
      .from("lessons")
      .select("id, lesson_number, title")
      .in("id", lessonIds);
    if (error) throw new Error(error.message);
    for (const lesson of lessons ?? []) {
      lessonLabelById.set(
        lesson.id as string,
        `Lesson ${lesson.lesson_number as number} — ${lesson.title as string}`
      );
    }
  }

  return duplicateRows.map((list) => {
    const first = list[0]!;
    return {
      cohortId: first.cohort_id as string,
      lessonDate: String(first.lesson_date).slice(0, 10),
      entries: list.map((row) => {
        const lessonId = (row.lesson_id as string | null) ?? null;
        const recording = (row.recording_url as string | null)?.trim() ?? "";
        const notionPageId = (row.notion_page_id as string | null)?.trim() ?? "";
        return {
          entryId: row.id as string,
          title: (row.lesson_title as string | null) ?? null,
          status: (row.status as string | null) ?? null,
          lessonLabel: lessonId ? (lessonLabelById.get(lessonId) ?? "Linked lesson") : "Not linked",
          hasRecording: recording.length > 0,
          source: (row.source as string | null) ?? null,
          notionUrl: notionPageId ? notionPageHref(notionPageId) : null,
        };
      }),
    };
  });
}

export const loadCohortOpsIssues = cache(loadCohortOpsIssuesUncached);
