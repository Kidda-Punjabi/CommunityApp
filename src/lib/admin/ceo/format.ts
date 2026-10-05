import type { CeoFormat, CeoMetric, CeoStatus } from "@/lib/admin/ceo/types";

const STATUS_LABEL: Record<CeoStatus, string> = {
  not_connected: "Not connected",
  needs_target: "Needs a target",
  on_target: "On target",
  watch: "Watch",
  off_target: "Off target",
};

export function ceoStatusLabel(status: CeoStatus): string {
  return STATUS_LABEL[status];
}

export function formatCeoValue(value: number | null, format: CeoFormat): string {
  if (value == null || !Number.isFinite(value)) return "n/a";
  if (format === "currency") {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0,
    }).format(value);
  }
  if (format === "percent") return `${Math.round(value * 100)}%`;
  if (format === "ratio") return value.toFixed(1);
  if (format === "score") return value.toFixed(1);
  if (format === "months") return `${value.toFixed(1)} months`;
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value);
}

export function formatCeoTarget(metric: CeoMetric): string {
  if (metric.target == null) return "No target yet";
  const value = formatCeoValue(metric.target, metric.format);
  return metric.direction === "max" ? `Target ${value} maximum` : `Target ${value} minimum`;
}

export function targetToInput(metric: CeoMetric): string {
  if (metric.target == null) return "";
  if (metric.format === "percent") {
    const percent = metric.target * 100;
    return String(Math.round(percent * 10) / 10);
  }
  return String(metric.target);
}

export function inputToTarget(format: CeoFormat, raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) throw new Error("Enter a number.");
  if (format === "percent") return value / 100;
  return value;
}
