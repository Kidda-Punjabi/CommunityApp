import type { CeoDirection, CeoMetric, CeoStatus, CeoTarget } from "@/lib/admin/ceo/types";

export function metricStatus(
  value: number | null,
  target: number | null,
  direction: CeoDirection,
  connected: boolean
): CeoStatus {
  if (!connected || value == null || !Number.isFinite(value)) return "not_connected";
  if (target == null || !Number.isFinite(target)) return "needs_target";
  if (direction === "min") {
    if (value >= target) return "on_target";
    if (target !== 0 && value >= target * 0.9) return "watch";
    return "off_target";
  }
  if (value <= target) return "on_target";
  if (target !== 0 && value <= target * 1.1) return "watch";
  return "off_target";
}

export function withTarget(metric: CeoMetric, target: number | null): CeoMetric {
  return {
    ...metric,
    target,
    status: metricStatus(metric.value, target, metric.direction, metric.status !== "not_connected"),
  };
}

export function applyTargets(metrics: CeoMetric[], targets: CeoTarget[]): CeoMetric[] {
  const byId = new Map(targets.map((row) => [row.id, row.target]));
  return metrics.map((metric) => withTarget(metric, byId.has(metric.id) ? (byId.get(metric.id) ?? null) : metric.target));
}
