"use server";

import { requireAdminFromActions } from "@/app/admin/content/actions";

export type CleanupRunSummary = {
  startedAt: string;
  finishedAt: string | null;
  dryRun: boolean;
  filesFound: number;
  filesDeleted: number;
  errorCount: number;
  status: "running" | "ok" | "failed";
};

export async function fetchLatestCleanupRun(): Promise<{
  run: CleanupRunSummary | null;
  error?: string;
}> {
  try {
    const supabase = await requireAdminFromActions();
    const { data, error } = await supabase
      .from("data_cleanup_runs")
      .select("started_at, finished_at, dry_run, files_found, files_deleted, error_count, status")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { run: null, error: error.message };
    if (!data) return { run: null };
    return {
      run: {
        startedAt: data.started_at as string,
        finishedAt: (data.finished_at as string | null) ?? null,
        dryRun: Boolean(data.dry_run),
        filesFound: Number(data.files_found ?? 0),
        filesDeleted: Number(data.files_deleted ?? 0),
        errorCount: Number(data.error_count ?? 0),
        status: data.status as CleanupRunSummary["status"],
      },
    };
  } catch (error) {
    return {
      run: null,
      error: error instanceof Error ? error.message : "Could not load the file sweep.",
    };
  }
}
