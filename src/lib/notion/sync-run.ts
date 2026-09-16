import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type NotionSyncStepResult = {
  ok: boolean;
  threw?: boolean;
  errors: string[];
  [key: string]: unknown;
};

export type NotionSyncRunSteps = Record<string, NotionSyncStepResult | string | null>;

export type NotionSyncRunOutcome = "running" | "skipped_overlap" | "succeeded" | "failed";

function tableMissing(error: { message?: string } | null): boolean {
  return Boolean(error?.message?.includes("notion_sync_runs"));
}

export async function insertNotionSyncRun(
  supabase: SupabaseClient,
  input: {
    outcome: NotionSyncRunOutcome;
    skippedOverlap?: boolean;
    steps?: NotionSyncRunSteps;
    error?: string | null;
    startedAt?: string;
    finishedAt?: string | null;
    durationMs?: number | null;
  }
): Promise<string | null> {
  const startedAt = input.startedAt ?? new Date().toISOString();
  const { data, error } = await supabase
    .from("notion_sync_runs")
    .insert({
      started_at: startedAt,
      finished_at: input.finishedAt ?? (input.outcome === "running" ? null : new Date().toISOString()),
      duration_ms: input.durationMs ?? null,
      outcome: input.outcome,
      skipped_overlap: input.skippedOverlap ?? false,
      steps: input.steps ?? {},
      error: input.error ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (!tableMissing(error)) {
      console.error("[notion-sync] failed to insert run row:", error.message);
    }
    return null;
  }
  return data?.id ?? null;
}

export async function finishNotionSyncRun(
  supabase: SupabaseClient,
  runId: string | null,
  input: {
    startedAt: string;
    outcome: NotionSyncRunOutcome;
    steps: NotionSyncRunSteps;
    error?: string | null;
  }
): Promise<void> {
  if (!runId) return;
  const finishedAt = new Date().toISOString();
  const durationMs = Math.max(
    0,
    new Date(finishedAt).getTime() - new Date(input.startedAt).getTime()
  );
  const { error } = await supabase
    .from("notion_sync_runs")
    .update({
      finished_at: finishedAt,
      duration_ms: durationMs,
      outcome: input.outcome,
      steps: input.steps,
      error: input.error ?? null,
    })
    .eq("id", runId);

  if (error && !tableMissing(error)) {
    console.error("[notion-sync] failed to finish run row:", error.message);
  }
}

export function stepFromResult(
  result: { errors?: string[] } | null | undefined,
  extra?: Record<string, unknown>
): NotionSyncStepResult {
  const errors = result?.errors ?? [];
  return {
    ok: errors.length === 0,
    errors,
    ...extra,
    ...(result ?? {}),
  };
}
