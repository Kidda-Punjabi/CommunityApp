"use server";

import { requireAdminFromActions } from "@/app/admin/content/actions";
import { applyTargets } from "@/lib/admin/ceo/status";
import { refreshCeoMetrics, snapshotFromRow } from "@/lib/admin/ceo/refresh";
import type { CeoSnapshot, CeoTarget } from "@/lib/admin/ceo/types";

export async function fetchCeoSnapshot(): Promise<{ snapshot: CeoSnapshot | null; error?: string }> {
  try {
    const supabase = await requireAdminFromActions();
    const { data, error } = await supabase
      .from("ceo_metric_snapshots")
      .select("snapshot_date, period_start, period_end, created_at, metrics, actions")
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { snapshot: null, error: error.message };
    if (!data) return { snapshot: null };
    return { snapshot: snapshotFromRow(data) };
  } catch (error) {
    return { snapshot: null, error: error instanceof Error ? error.message : "Could not load the overview." };
  }
}

export async function refreshCeoSnapshot(): Promise<{ snapshot: CeoSnapshot | null; error?: string }> {
  try {
    const supabase = await requireAdminFromActions();
    const snapshot = await refreshCeoMetrics(supabase);
    return { snapshot };
  } catch (error) {
    return { snapshot: null, error: error instanceof Error ? error.message : "Could not refresh the overview." };
  }
}

export async function updateCeoTarget(
  metricId: string,
  target: number | null
): Promise<{ snapshot: CeoSnapshot | null; error?: string }> {
  try {
    const supabase = await requireAdminFromActions();
    const { error: updateError } = await supabase
      .from("ceo_metric_targets")
      .update({ target })
      .eq("metric_id", metricId);
    if (updateError) return { snapshot: null, error: updateError.message };

    const { data, error } = await supabase
      .from("ceo_metric_snapshots")
      .select("snapshot_date, period_start, period_end, created_at, metrics, actions")
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { snapshot: null, error: error.message };
    if (!data) return { snapshot: null };

    const { data: targets, error: targetError } = await supabase
      .from("ceo_metric_targets")
      .select("metric_id, target");
    if (targetError) return { snapshot: null, error: targetError.message };

    const snapshot = snapshotFromRow(data);
    const nextMetrics = applyTargets(
      snapshot.metrics,
      (targets ?? []).map((row) => ({ id: row.metric_id as string, target: row.target == null ? null : Number(row.target) }) as CeoTarget)
    );
    const { error: saveError } = await supabase
      .from("ceo_metric_snapshots")
      .update({ metrics: nextMetrics })
      .eq("snapshot_date", snapshot.snapshotDate);
    if (saveError) return { snapshot: null, error: saveError.message };
    return { snapshot: { ...snapshot, metrics: nextMetrics } };
  } catch (error) {
    return { snapshot: null, error: error instanceof Error ? error.message : "Could not save the target." };
  }
}
