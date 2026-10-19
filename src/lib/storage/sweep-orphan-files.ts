import "server-only";

import { sendCleanupFailureEmail } from "@/lib/email/send-cleanup-failure";
import {
  cleanupDryRunEnabled,
  isLondonCleanupWindow,
  shouldNotifyCleanupFailure,
} from "@/lib/storage/cleanup-schedule";
import { removeStorageRefs, type StorageRef } from "@/lib/storage/linked-user-files";
import { markNoticesDeleted, scheduleDeletionNotices } from "@/lib/storage/schedule-deletion-notices";
import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE_SIZE = 500;
const MAX_PAGES = 40;
const SAMPLE_LIMIT = 25;

type OrphanRow = { bucket_id: string; name: string; created_at: string };

export type OrphanSweepResult = {
  skipped?: boolean;
  reason?: string;
  dryRun: boolean;
  filesFound: number;
  filesDeleted: number;
  errorCount: number;
  samplePaths: string[];
  status: "ok" | "failed" | "skipped";
};

export async function runOrphanFileSweep(
  admin: SupabaseClient,
  options: { force?: boolean; now?: Date } = {}
): Promise<OrphanSweepResult> {
  const now = options.now ?? new Date();
  if (!options.force && !isLondonCleanupWindow(now)) {
    return {
      skipped: true,
      reason: "Outside the 03:30 Europe/London window.",
      dryRun: cleanupDryRunEnabled(),
      filesFound: 0,
      filesDeleted: 0,
      errorCount: 0,
      samplePaths: [],
      status: "skipped",
    };
  }

  const dryRun = cleanupDryRunEnabled();
  const startedAt = now.toISOString();
  const { data: previous } = await admin
    .from("data_cleanup_runs")
    .select("status")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  try {
    const orphans = await listOrphans(admin);
    const files: StorageRef[] = orphans.map((row) => ({ bucket: row.bucket_id, path: row.name }));
    const samplePaths = files.slice(0, SAMPLE_LIMIT).map((file) => `${file.bucket}/${file.path}`);
    const scheduled = await scheduleDeletionNotices(admin, files, now);
    // A file is deleted only after the 14-day and 3-day emails, on its delete date.
    const ready = scheduled.due;
    const removal = ready.length === 0 ? { removed: 0, errors: [] } : await removeStorageRefs(admin, ready);
    if (removal.removed > 0) {
      const failedKeys = new Set(removal.errors.map((error) => `${error.bucket}/${error.path}`));
      await markNoticesDeleted(
        admin,
        ready.filter((file) => !failedKeys.has(`${file.bucket}/${file.path}`)),
        now
      );
    }
    const errors = [
      ...removal.errors,
      ...(scheduled.emailError ? [{ message: scheduled.emailError }] : []),
    ];
    const failed = ready.length > 0 && removal.removed === 0 && removal.errors.length > 0;
    const status = failed ? "failed" : "ok";

    const { error: insertError } = await admin.from("data_cleanup_runs").insert({
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      dry_run: dryRun,
      files_found: files.length,
      files_deleted: removal.removed,
      error_count: errors.length,
      errors: errors.slice(0, 20),
      sample_paths: samplePaths,
      status,
    });
    if (insertError) {
      console.error("[data-cleanup] could not record the sweep", insertError.message);
    }

    if (removal.errors.length > 0) {
      console.error("[data-cleanup] storage remove errors", removal.errors.length);
    }

    if (shouldNotifyCleanupFailure(previous?.status as string | undefined, status === "failed")) {
      await notifyFailure(files.length, removal.errors[0]?.message ?? "Every file delete failed.");
    }

    return {
      dryRun,
      filesFound: files.length,
      filesDeleted: removal.removed,
      errorCount: errors.length,
      samplePaths,
      status,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "File sweep failed.";
    console.error("[data-cleanup] sweep failed", message);
    await admin.from("data_cleanup_runs").insert({
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      dry_run: dryRun,
      files_found: 0,
      files_deleted: 0,
      error_count: 1,
      errors: [{ message }],
      sample_paths: [],
      status: "failed",
    });
    if (shouldNotifyCleanupFailure(previous?.status as string | undefined, true)) {
      await notifyFailure(0, message);
    }
    throw error;
  }
}

async function listOrphans(admin: SupabaseClient): Promise<OrphanRow[]> {
  const rows: OrphanRow[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await admin.rpc("list_orphan_user_files", {
      row_limit: PAGE_SIZE,
      row_offset: page * PAGE_SIZE,
    });
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as OrphanRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

async function notifyFailure(filesFound: number, message: string) {
  const sent = await sendCleanupFailureEmail({ filesFound, message });
  if (sent.error) console.error("[data-cleanup] failure email failed", sent.error);
}
