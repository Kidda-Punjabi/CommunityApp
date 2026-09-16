import "server-only";

import {
  LEADS_CACHE_PULL_CURSOR_NAME,
  LEADS_CACHE_PULL_CURSOR_VIEW_TYPE,
} from "@/lib/notion/lead-sync";
import {
  LESSON_LOG_PULL_CURSOR_NAME,
  LESSON_LOG_PULL_CURSOR_VIEW_TYPE,
} from "@/lib/notion/lesson-log-sync";
import {
  PACKAGE_PULL_CURSOR_NAME,
  PACKAGE_PULL_CURSOR_VIEW_TYPE,
} from "@/lib/notion/package-sync";
import { NOTION_SYNC_LOCK_NAME } from "@/lib/notion/sync-lock";
import { getDisplayName } from "@/lib/profile/display-name";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  SyncHealthConflict,
  SyncHealthFailure,
  SyncHealthGrantQueue,
  SyncHealthLastRun,
  SyncHealthLessonError,
  SyncHealthLock,
  SyncHealthSnapshot,
  SyncHealthWatermark,
} from "./types";

type CursorConfig = {
  lastEditedTime?: string;
  savedAt?: string;
};

async function loadWatermark(
  supabase: SupabaseClient,
  viewType: string,
  name: string,
  id: SyncHealthWatermark["id"],
  label: string
): Promise<SyncHealthWatermark> {
  const { data } = await supabase
    .from("admin_saved_views")
    .select("config")
    .eq("view_type", viewType)
    .eq("name", name)
    .maybeSingle();
  const config = (data?.config as CursorConfig | null) ?? null;
  return {
    id,
    label,
    lastEditedTime: config?.lastEditedTime?.trim() || null,
    savedAt: config?.savedAt?.trim() || null,
  };
}

function emptyLock(): SyncHealthLock {
  return { held: false, holder: null, acquiredAt: null, expiresAt: null };
}

export async function loadSyncHealth(
  supabase: SupabaseClient
): Promise<SyncHealthSnapshot> {
  const errors: string[] = [];

  const [
    runResult,
    lockResult,
    watermarks,
    lessonErrorResult,
    failureResult,
    conflictResult,
    grantResult,
  ] = await Promise.all([
    supabase
      .from("notion_sync_runs")
      .select("id, started_at, finished_at, duration_ms, outcome, skipped_overlap, steps, error")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("notion_sync_locks")
      .select("holder, acquired_at, expires_at")
      .eq("name", NOTION_SYNC_LOCK_NAME)
      .maybeSingle(),
    Promise.all([
      loadWatermark(
        supabase,
        LEADS_CACHE_PULL_CURSOR_VIEW_TYPE,
        LEADS_CACHE_PULL_CURSOR_NAME,
        "leadsCache",
        "Leads cache"
      ),
      loadWatermark(
        supabase,
        PACKAGE_PULL_CURSOR_VIEW_TYPE,
        PACKAGE_PULL_CURSOR_NAME,
        "packages",
        "Package pull"
      ),
      loadWatermark(
        supabase,
        LESSON_LOG_PULL_CURSOR_VIEW_TYPE,
        LESSON_LOG_PULL_CURSOR_NAME,
        "lessonLog",
        "Lessons Log pull"
      ),
    ]),
    supabase
      .from("cohort_lesson_log_entries")
      .select("id, notion_page_id, lesson_title, lesson_date, notion_sync_error, notion_synced_at")
      .eq("notion_sync_status", "error")
      .order("notion_synced_at", { ascending: false, nullsFirst: false })
      .limit(50),
    supabase
      .from("notion_lesson_log_sync_failures")
      .select("notion_page_id, last_edited_time, error, retry_count, last_failed_at")
      .order("last_failed_at", { ascending: false })
      .limit(50),
    supabase
      .from("notion_lead_link_conflicts")
      .select("id, profile_id, lead_email, details, created_at")
      .eq("resolved", false)
      .order("created_at", { ascending: true })
      .limit(50),
    supabase
      .from("notion_lead_purchase_grant_queue")
      .select("id, profile_id, lead_name, lead_email, reason, created_at")
      .eq("resolved", false)
      .order("created_at", { ascending: true })
      .limit(50),
  ]);

  if (runResult.error && !runResult.error.message.includes("notion_sync_runs")) {
    errors.push(runResult.error.message);
  }
  if (lockResult.error && !lockResult.error.message.includes("notion_sync_locks")) {
    errors.push(lockResult.error.message);
  }
  if (lessonErrorResult.error) errors.push(lessonErrorResult.error.message);
  if (
    failureResult.error &&
    !failureResult.error.message.includes("notion_lesson_log_sync_failures")
  ) {
    errors.push(failureResult.error.message);
  }
  if (conflictResult.error) errors.push(conflictResult.error.message);
  if (grantResult.error) errors.push(grantResult.error.message);

  const lastRunRow = runResult.data;
  const lastRun: SyncHealthLastRun | null = lastRunRow
    ? {
        id: lastRunRow.id as string,
        startedAt: lastRunRow.started_at as string,
        finishedAt: (lastRunRow.finished_at as string | null) ?? null,
        durationMs: (lastRunRow.duration_ms as number | null) ?? null,
        outcome: lastRunRow.outcome as SyncHealthLastRun["outcome"],
        skippedOverlap: Boolean(lastRunRow.skipped_overlap),
        steps: (lastRunRow.steps as SyncHealthLastRun["steps"]) ?? {},
        error: (lastRunRow.error as string | null) ?? null,
      }
    : null;

  const lockRow = lockResult.data;
  const expiresAt = (lockRow?.expires_at as string | null) ?? null;
  const lockHeld = Boolean(expiresAt && new Date(expiresAt).getTime() > Date.now());
  const lock: SyncHealthLock = lockRow
    ? {
        held: lockHeld,
        holder: (lockRow.holder as string | null) ?? null,
        acquiredAt: (lockRow.acquired_at as string | null) ?? null,
        expiresAt,
      }
    : emptyLock();

  const lessonErrors: SyncHealthLessonError[] = (lessonErrorResult.data ?? []).map((row) => ({
    id: row.id as string,
    notionPageId: (row.notion_page_id as string | null) ?? null,
    title: (row.lesson_title as string | null) ?? null,
    lessonDate: (row.lesson_date as string | null) ?? null,
    error: (row.notion_sync_error as string | null) ?? null,
    syncedAt: (row.notion_synced_at as string | null) ?? null,
  }));

  const failures: SyncHealthFailure[] = (failureResult.data ?? []).map((row) => ({
    notionPageId: row.notion_page_id as string,
    lastEditedTime: (row.last_edited_time as string | null) ?? null,
    error: (row.error as string | null) ?? null,
    retryCount: Number(row.retry_count ?? 0),
    lastFailedAt: row.last_failed_at as string,
  }));

  const conflictRows = conflictResult.data ?? [];
  const grantRows = grantResult.data ?? [];
  const profileIds = [
    ...new Set(
      [
        ...conflictRows.map((row) => row.profile_id as string),
        ...grantRows.map((row) => row.profile_id as string | null),
      ].filter((id): id is string => Boolean(id))
    ),
  ];

  const { data: profiles } =
    profileIds.length > 0
      ? await supabase.from("profiles").select("id, full_name, preferred_name").in("id", profileIds)
      : { data: [] as Array<{ id: string; full_name: string | null; preferred_name: string | null }> };

  const labelById = new Map(
    (profiles ?? []).map((row) => [row.id, getDisplayName(row) ?? row.id.slice(0, 8)] as const)
  );

  const conflicts: SyncHealthConflict[] = conflictRows.map((row) => ({
    id: row.id as string,
    profileId: row.profile_id as string,
    person: labelById.get(row.profile_id as string) ?? (row.profile_id as string).slice(0, 8),
    email: (row.lead_email as string | null) ?? null,
    reason: (row.details as string | null) ?? "Ambiguous email matched more than one Notion lead.",
    stuckSince: row.created_at as string,
  }));

  const grantQueue: SyncHealthGrantQueue[] = grantRows.map((row) => ({
    id: row.id as string,
    profileId: (row.profile_id as string | null) ?? null,
    person:
      (row.lead_name as string | null)?.trim() ||
      (row.profile_id
        ? (labelById.get(row.profile_id as string) ?? (row.profile_id as string).slice(0, 8))
        : "Unknown"),
    email: (row.lead_email as string | null) ?? null,
    reason: row.reason as string,
    stuckSince: row.created_at as string,
  }));

  return {
    lastRun,
    watermarks,
    lock,
    lessonErrors,
    failures,
    conflicts,
    grantQueue,
    error: errors.length > 0 ? errors.join(" · ") : undefined,
  };
}

export async function countSyncHealthAttention(
  supabase: SupabaseClient
): Promise<{ count: number; lastRunFailed: boolean; error?: string }> {
  const [errors, failures, conflicts, grants, lastRun] = await Promise.all([
    supabase
      .from("cohort_lesson_log_entries")
      .select("id", { count: "exact", head: true })
      .eq("notion_sync_status", "error"),
    supabase
      .from("notion_lesson_log_sync_failures")
      .select("notion_page_id", { count: "exact", head: true }),
    supabase
      .from("notion_lead_link_conflicts")
      .select("id", { count: "exact", head: true })
      .eq("resolved", false),
    supabase
      .from("notion_lead_purchase_grant_queue")
      .select("id", { count: "exact", head: true })
      .eq("resolved", false),
    supabase
      .from("notion_sync_runs")
      .select("outcome")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const missing =
    failures.error?.message.includes("notion_lesson_log_sync_failures") ||
    conflicts.error?.message.includes("resolved") ||
    lastRun.error?.message.includes("notion_sync_runs");

  if (missing) {
    const fallback = (errors.count ?? 0) + (grants.count ?? 0);
    return { count: fallback, lastRunFailed: false, error: undefined };
  }

  const messages = [errors.error, failures.error, conflicts.error, grants.error, lastRun.error]
    .map((item) => item?.message)
    .filter((message): message is string => Boolean(message));

  return {
    count:
      (errors.count ?? 0) +
      (failures.count ?? 0) +
      (conflicts.count ?? 0) +
      (grants.count ?? 0),
    lastRunFailed: lastRun.data?.outcome === "failed",
    error: messages.length > 0 ? messages.join(" · ") : undefined,
  };
}
