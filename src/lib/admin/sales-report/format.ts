import type { ComparedNumber } from "@/lib/admin/sales-report/types";

export function formatPounds(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2,
  }).format(value);
}

export function formatCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-GB").format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${Math.round(value * 100)}%`;
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}

export function comparisonHint(metric: ComparedNumber, kind: "count" | "money" | "rate"): string {
  if (metric.previous == null) return "No previous period";
  if (kind === "rate") {
    const pts = Math.round((metric.vsPreviousPts ?? 0) * 100);
    if (pts === 0) return "Steady vs previous";
    return `${pts > 0 ? "Up" : "Down"} ${Math.abs(pts)}pts vs previous`;
  }
  if (metric.previous === 0) return "No previous period baseline";
  const pct = Math.round(Math.abs(metric.vsPreviousPct ?? 0) * 100);
  if (pct === 0) return "Steady vs previous";
  if (kind === "money") {
    return `${metric.vsPreviousDirection === "down" ? "Down" : "Up"} ${formatPounds(Math.abs(metric.current - metric.previous))} vs previous`;
  }
  return `${metric.vsPreviousDirection === "down" ? "Down" : "Up"} ${pct}% vs previous`;
}

export function mtdHint(metric: ComparedNumber, kind: "count" | "money" | "rate"): string {
  if (metric.mtd == null) return "No month-to-date";
  if (kind === "rate") {
    const pts = Math.round((metric.vsMtdPts ?? 0) * 100);
    if (pts === 0) return "In line with MTD";
    return `${pts > 0 ? "Up" : "Down"} ${Math.abs(pts)}pts vs MTD`;
  }
  if (metric.mtd === 0) return "No MTD baseline";
  const pct = Math.round(Math.abs(metric.vsMtdPct ?? 0) * 100);
  if (pct === 0) return "In line with MTD";
  return `${metric.vsMtdDirection === "down" ? "Down" : "Up"} ${pct}% vs MTD`;
}
