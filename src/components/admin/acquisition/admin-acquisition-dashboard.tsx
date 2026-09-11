"use client";

import { fetchAcquisitionDashboard } from "@/app/admin/content/acquisition-actions";
import type {
  AcquisitionRangeId,
  AcquisitionSnapshot,
  AcquisitionSourceSync,
  CashDiscrepancyRow,
  CountMetric,
  FunnelStage,
  MoneyMetric,
  RateMetric,
  UpcomingCohortRow,
} from "@/lib/admin/acquisition/types";
import { cn } from "@/lib/ui/styles";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const RANGES: Array<{ id: AcquisitionRangeId; label: string }> = [
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "quarter", label: "Quarter" },
  { id: "custom", label: "Custom" },
];

function formatPounds(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function formatPence(pence: number | null | undefined): string {
  if (pence == null) return "—";
  return formatPounds(pence / 100);
}

function formatCount(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-GB").format(value);
}

function formatPercent(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

function formatDays(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${Math.round(value)}`;
}

function formatDateUk(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  });
}

function relativeSync(iso: string | null): string {
  if (!iso) return "Not synced";
  const deltaMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(deltaMs) || deltaMs < 0) return "Synced just now";
  const minutes = Math.round(deltaMs / 60000);
  if (minutes < 1) return "Synced just now";
  if (minutes === 1) return "Synced 1 min ago";
  if (minutes < 60) return `Synced ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours === 1) return "Synced 1 hour ago";
  return `Synced ${hours} hours ago`;
}

function latestSourceRead(sources: AcquisitionSourceSync[]): string | null {
  const times = sources
    .map((source) => source.readAt)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((time) => Number.isFinite(time));
  if (times.length === 0) return null;
  return new Date(Math.max(...times)).toISOString();
}

function countDelta(metric: CountMetric): { text: string; tone: "up" | "down" | "flat" } | null {
  if (metric.availability !== "ok" || metric.value == null || metric.previous == null) return null;
  if (metric.previous === 0) return { text: "No prior period", tone: "flat" };
  const change = (metric.value - metric.previous) / metric.previous;
  if (Math.abs(change) < 0.005) return { text: "— steady", tone: "flat" };
  const pts = Math.round(Math.abs(change) * 100);
  return {
    text: `${change > 0 ? "↑" : "↓"} ${pts}% vs prior`,
    tone: change > 0 ? "up" : "down",
  };
}

function rateDelta(metric: RateMetric): { text: string; tone: "up" | "down" | "flat" } | null {
  if (metric.availability !== "ok" || metric.value == null || metric.previous == null) return null;
  const pts = Math.round((metric.value - metric.previous) * 100);
  if (pts === 0) return { text: "— steady", tone: "flat" };
  return {
    text: `${pts > 0 ? "↑" : "↓"} ${Math.abs(pts)}pts`,
    tone: pts > 0 ? "up" : "down",
  };
}

function moneyDelta(metric: MoneyMetric): { text: string; tone: "up" | "down" | "flat" } | null {
  if (metric.availability !== "ok" || metric.value == null || metric.previous == null) return null;
  const diff = metric.value - metric.previous;
  if (Math.abs(diff) < 1) return { text: "— steady", tone: "flat" };
  return {
    text: `${diff > 0 ? "↑" : "↓"} ${formatPounds(Math.abs(diff))}`,
    tone: diff > 0 ? "up" : "down",
  };
}

function kpiDisplay(
  metric: CountMetric | RateMetric | MoneyMetric,
  kind: "count" | "rate" | "money"
): { value: string; hint: string; tone: "up" | "down" | "flat" } {
  if (metric.availability === "unavailable") {
    return { value: "—", hint: metric.reason ?? "No data", tone: "flat" };
  }
  if (metric.availability === "empty") {
    return { value: "—", hint: metric.reason ?? "None in this period", tone: "flat" };
  }
  const value =
    kind === "count"
      ? formatCount((metric as CountMetric).value)
      : kind === "rate"
        ? formatPercent((metric as RateMetric).value)
        : formatPounds((metric as MoneyMetric).value);
  const delta =
    kind === "count"
      ? countDelta(metric as CountMetric)
      : kind === "rate"
        ? rateDelta(metric as RateMetric)
        : moneyDelta(metric as MoneyMetric);
  return { value, hint: delta?.text ?? "Current period", tone: delta?.tone ?? "flat" };
}

const pillClass: Record<UpcomingCohortRow["status"], string> = {
  ontrack: "bg-[#E7F2EC] text-[#2F6B4F]",
  atrisk: "bg-[#FBF0DC] text-[#B8842A]",
  full: "bg-[#F1E7F8] text-[#4A2E6B]",
  behind: "bg-[#FBEAE7] text-[#AE4335]",
  unknown: "bg-zinc-100 text-zinc-600",
};

export function AdminAcquisitionDashboard() {
  const [rangeId, setRangeId] = useState<AcquisitionRangeId>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [snapshot, setSnapshot] = useState<AcquisitionSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const applyResult = useCallback((result: { snapshot?: AcquisitionSnapshot; error?: string }) => {
    if (result.error || !result.snapshot) {
      setSnapshot(null);
      setError(result.error ?? "Failed to load acquisition.");
    } else {
      setSnapshot(result.snapshot);
      setError(null);
    }
    setLoading(false);
  }, []);

  const load = useCallback(
    async (nextRange: AcquisitionRangeId, from?: string, to?: string) => {
      setLoading(true);
      setError(null);
      const result = await fetchAcquisitionDashboard({
        rangeId: nextRange,
        from: nextRange === "custom" ? from : undefined,
        to: nextRange === "custom" ? to : undefined,
      });
      applyResult(result);
    },
    [applyResult]
  );

  useEffect(() => {
    let cancelled = false;
    void fetchAcquisitionDashboard({ rangeId: "30d" }).then((result) => {
      if (cancelled) return;
      applyResult(result);
    });
    return () => {
      cancelled = true;
    };
  }, [applyResult]);

  const leadsCount = snapshot?.funnel.find((stage) => stage.id === "leads")?.count ?? 0;
  const maxFillDays = useMemo(() => {
    const days = (snapshot?.timeToFill ?? []).map((point) => point.days ?? 0);
    return Math.max(1, ...days);
  }, [snapshot]);

  return (
    <div className="text-[#241934]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-xl text-sm leading-relaxed text-[#71667E]">
          Leads through to closed sales, cohort fill, and how fast the pipeline is converting to
          revenue.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex overflow-hidden rounded-[9px] border border-[#E9E2F0] bg-white text-[13.5px]">
            {RANGES.map((range) => (
              <button
                key={range.id}
                type="button"
                onClick={() => {
                  setRangeId(range.id);
                  if (range.id !== "custom") void load(range.id);
                }}
                className={cn(
                  "px-3.5 py-2 font-medium",
                  rangeId === range.id ? "bg-[#4A2E6B] text-white" : "text-[#71667E]"
                )}
              >
                {range.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 rounded-[9px] bg-[#E7F2EC] px-3 py-1.5 text-[13px] font-semibold text-[#2F6B4F]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#2F6B4F]" />
            {relativeSync(latestSourceRead(snapshot?.sources ?? []))}
          </div>
        </div>
      </div>

      {rangeId === "custom" ? (
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (customFrom && customTo) void load("custom", customFrom, customTo);
          }}
        >
          <label className="text-xs text-[#71667E]">
            From
            <input
              type="date"
              value={customFrom}
              onChange={(event) => setCustomFrom(event.target.value)}
              className="mt-1 block rounded-md border border-[#E9E2F0] px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-[#71667E]">
            To
            <input
              type="date"
              value={customTo}
              onChange={(event) => setCustomTo(event.target.value)}
              className="mt-1 block rounded-md border border-[#E9E2F0] px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-[#4A2E6B] px-3 py-1.5 text-sm font-semibold text-white"
          >
            Apply
          </button>
        </form>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </p>
      ) : null}

      {loading && !snapshot ? (
        <div className="mt-6 animate-pulse space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-28 rounded-lg bg-zinc-100" />
            ))}
          </div>
          <div className="h-64 rounded-xl bg-zinc-100" />
        </div>
      ) : snapshot ? (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3.5 lg:grid-cols-5">
            <KpiCard label="New leads" {...kpiDisplay(snapshot.kpis.newLeads, "count")} />
            <KpiCard label="Calls booked" {...kpiDisplay(snapshot.kpis.callsBooked, "count")} />
            <KpiCard label="Show rate" {...kpiDisplay(snapshot.kpis.showRate, "rate")} />
            <KpiCard label="Close rate" {...kpiDisplay(snapshot.kpis.closeRate, "rate")} />
            <KpiCard
              label="Avg package value"
              {...kpiDisplay(snapshot.kpis.avgPackageValue, "money")}
            />
          </div>

          <div className="mt-4 grid items-stretch gap-4 lg:grid-cols-[1.6fr_1fr]">
            <section className="rounded-xl border border-[#E9E2F0] bg-white p-6">
              <h2 className="font-heading text-[17px] font-semibold">Lead to close funnel</h2>
              <p className="mb-5 mt-1 text-[13px] leading-relaxed text-[#71667E]">
                {snapshot.rangeLabel}. Percentage shown is conversion from the stage above it.
              </p>
              <Funnel stages={snapshot.funnel} leadCount={leadsCount} />
            </section>

            <section className="rounded-xl border border-[#E9E2F0] bg-white p-6">
              <h2 className="font-heading text-[17px] font-semibold">Sales velocity</h2>
              <p className="mb-4 mt-1 text-[13px] leading-relaxed text-[#71667E]">
                How fast the pipeline turns into revenue, in pounds per day.
              </p>
              {snapshot.velocity.availability === "ok" && snapshot.velocity.poundsPerDay != null ? (
                <>
                  <p className="font-heading text-[38px] font-bold leading-none text-[#4A2E6B]">
                    {formatPounds(snapshot.velocity.poundsPerDay)}
                  </p>
                  <p className="mb-4 mt-1 text-[13px] text-[#71667E]">per day</p>
                </>
              ) : (
                <p className="mb-4 text-sm text-[#71667E]">
                  {snapshot.velocity.reason ?? "Not enough data to compute sales velocity."}
                </p>
              )}
              <div className="mb-3.5 flex flex-wrap items-center justify-between gap-1.5 rounded-[9px] bg-[#F1E7F8] p-3.5">
                <FormulaPart
                  value={formatCount(snapshot.velocity.opportunities.value)}
                  label="opportunities"
                />
                <span className="text-[15px] font-semibold text-[#71667E]">×</span>
                <FormulaPart
                  value={formatPercent(snapshot.velocity.winRate.value)}
                  label="win rate"
                />
                <span className="text-[15px] font-semibold text-[#71667E]">×</span>
                <FormulaPart
                  value={formatPounds(snapshot.velocity.avgValue.value)}
                  label="avg value"
                />
                <span className="text-[15px] font-semibold text-[#71667E]">÷</span>
                <FormulaPart
                  value={formatDays(snapshot.velocity.cycleDays.value)}
                  label="day cycle"
                />
              </div>
              <p className="m-0 text-[12.5px] leading-relaxed text-[#71667E]">
                Sales velocity multiplies how many people enter the pipeline, how often they buy,
                and how much they spend, then divides by how long a sale takes.{" "}
                <span className="font-semibold text-[#241934]">
                  Move any one of those four and this number moves with it
                </span>{" "}
                — it&apos;s the single figure for whether the sales motion is speeding up or slowing
                down.
              </p>
            </section>
          </div>

          <section className="mt-4 rounded-xl border border-[#E9E2F0] bg-white p-6">
            <h2 className="font-heading text-[17px] font-semibold">Upcoming cohorts</h2>
            <p className="mb-5 mt-1 text-[13px] leading-relaxed text-[#71667E]">
              Seats filled against capacity, and how many days are left before the start date.
            </p>
            {snapshot.upcomingCohorts.length === 0 ? (
              <p className="text-sm text-[#71667E]">No upcoming cohorts with a start date.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13.5px]">
                  <thead>
                    <tr className="border-b border-[#E9E2F0] text-left text-xs font-medium text-[#71667E]">
                      <th className="pb-2.5 font-medium">Cohort</th>
                      <th className="pb-2.5 font-medium">Starts</th>
                      <th className="pb-2.5 font-medium">Seats</th>
                      <th className="pb-2.5 font-medium">Days to fill</th>
                      <th className="pb-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.upcomingCohorts.map((cohort) => (
                      <CohortRow key={cohort.id} cohort={cohort} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-[#E9E2F0] bg-white p-6">
              <h2 className="font-heading text-[17px] font-semibold">Time to fill a cohort</h2>
              <p className="mb-4 mt-1 text-[13px] leading-relaxed text-[#71667E]">
                Average days from the first seat sold to a full cohort, last 6 filled cohorts.
              </p>
              {snapshot.timeToFill.length === 0 ? (
                <p className="text-sm text-[#71667E]">
                  No filled cohorts yet — time-to-fill appears once a cohort reaches capacity.
                </p>
              ) : (
                <>
                  <div className="mb-1.5 flex h-[90px] items-end gap-2.5">
                    {snapshot.timeToFill.map((point) => {
                      const height = point.days == null ? 0 : (point.days / maxFillDays) * 100;
                      const best =
                        point.days != null &&
                        point.days === Math.min(...snapshot.timeToFill.map((row) => row.days ?? Infinity));
                      return (
                        <div
                          key={point.label}
                          className={cn(
                            "relative flex-1 rounded-t-[5px]",
                            best ? "bg-[#4A2E6B]" : "bg-[#F1E7F8]"
                          )}
                          style={{ height: `${Math.max(8, height)}%` }}
                        >
                          <span className="absolute inset-x-0 -top-[18px] text-center text-[11px] font-semibold text-[#71667E]">
                            {point.days == null ? "—" : `${Math.round(point.days)}d`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-2.5">
                    {snapshot.timeToFill.map((point) => (
                      <div
                        key={point.label}
                        className="flex-1 text-center text-[11px] text-[#71667E]"
                      >
                        {point.label}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>

            <section className="rounded-xl border border-[#E9E2F0] bg-white p-6">
              <h2 className="font-heading text-[17px] font-semibold">Cash collected</h2>
              <p className="mb-4 mt-1 text-[13px] leading-relaxed text-[#71667E]">
                Live from Stripe webhook events, {snapshot.rangeLabel.toLowerCase()}.
              </p>
              {snapshot.cash.stripe.availability === "ok" && snapshot.cash.stripe.value != null ? (
                <>
                  <p className="font-heading text-[38px] font-bold leading-none text-[#4A2E6B]">
                    {formatPounds(snapshot.cash.stripe.value)}
                  </p>
                  <p className="mt-1 text-[13px] text-[#71667E]">
                    {formatCount(snapshot.cash.paymentCount.value)} payments · avg{" "}
                    {formatPounds(snapshot.cash.avgPayment.value)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-[#71667E]">
                  {snapshot.cash.stripe.reason ?? "No Stripe cash in this period."}
                </p>
              )}
              {snapshot.cash.breakdown ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-[9px] bg-[#F1E7F8] p-3.5">
                  <FormulaPart
                    value={formatPence(snapshot.cash.breakdown.groupPence)}
                    label="group packages"
                  />
                  <FormulaPart
                    value={formatPence(snapshot.cash.breakdown.oneToOnePence)}
                    label="1‑1 packages"
                  />
                  <FormulaPart
                    value={formatPence(snapshot.cash.breakdown.communityPence)}
                    label="community"
                  />
                  {snapshot.cash.breakdown.otherPence > 0 ? (
                    <FormulaPart
                      value={formatPence(snapshot.cash.breakdown.otherPence)}
                      label="unclassified"
                    />
                  ) : null}
                </div>
              ) : null}

              <h3 className="mt-5 text-sm font-semibold">Sales call log split</h3>
              {snapshot.cash.notion.availability === "ok" ? (
                <div className="mt-2 flex flex-wrap gap-6 text-sm">
                  <div>
                    <p className="font-semibold">{formatPence(snapshot.cash.notion.cashOnCallPence)}</p>
                    <p className="text-[12px] text-[#71667E]">cash on call</p>
                  </div>
                  <div>
                    <p className="font-semibold">
                      {formatPence(snapshot.cash.notion.paidAfterwardsPence)}
                    </p>
                    <p className="text-[12px] text-[#71667E]">paid afterwards</p>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-[#71667E]">{snapshot.cash.notion.reason}</p>
              )}
            </section>
          </div>

          <section className="mt-4 rounded-xl border border-[#E9E2F0] bg-white p-6">
            <h2 className="font-heading text-[17px] font-semibold">Stripe vs sales call log</h2>
            <p className="mb-4 mt-1 text-[13px] leading-relaxed text-[#71667E]">
              Payments in Stripe that are missing or different on the Notion sales call log — update
              the log from{" "}
              <Link href="/admin/sales-calls" className="font-semibold text-[#4A2E6B] underline">
                Sales calls
              </Link>
              .
            </p>
            {snapshot.cash.discrepancy.length === 0 ? (
              <p className="text-sm text-[#71667E]">
                No unmatched payments in this period. Stripe and the sales call log agree.
              </p>
            ) : (
              <DiscrepancyTable rows={snapshot.cash.discrepancy} />
            )}
          </section>

          <div className="mt-5 flex flex-wrap items-center gap-5 text-xs text-[#71667E]">
            {snapshot.sources.map((source) => (
              <div key={`${source.id}-${source.label}`} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-sm"
                  style={{
                    background:
                      source.id === "stripe"
                        ? "#635BFF"
                        : source.id === "ghl"
                          ? "#0EA5E9"
                          : "#4A2E6B",
                  }}
                />
                {source.label}
                {source.error ? ` — ${source.error}` : source.readAt ? ` · ${relativeSync(source.readAt)}` : ""}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "up" | "down" | "flat";
}) {
  return (
    <div className="rounded-lg border-l-[3px] border-[#4A2E6B] bg-white px-[18px] py-4 shadow-[0_1px_2px_rgba(36,25,52,0.05)]">
      <p className="mb-2.5 text-[12.5px] font-medium text-[#71667E]">{label}</p>
      <p className="mb-2 font-heading text-[26px] font-semibold leading-none">{value}</p>
      <p
        className={cn(
          "text-[12.5px] font-semibold",
          tone === "up" && "text-[#2F6B4F]",
          tone === "down" && "text-[#AE4335]",
          tone === "flat" && "text-[#71667E]"
        )}
      >
        {hint}
      </p>
    </div>
  );
}

function FormulaPart({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-[70px] flex-1 text-center">
      <div className="text-[15px] font-bold">{value}</div>
      <div className="mt-0.5 text-[10.5px] text-[#71667E]">{label}</div>
    </div>
  );
}

function Funnel({ stages, leadCount }: { stages: FunnelStage[]; leadCount: number }) {
  const missing = stages.every(
    (stage) => stage.availability === "empty" || stage.availability === "unavailable"
  );
  if (missing) {
    return <p className="text-sm text-[#71667E]">No funnel activity in this period.</p>;
  }

  return (
    <div>
      {stages.map((stage, index) => {
        const width =
          leadCount > 0 && stage.count != null
            ? Math.min(100, Math.max(8, (stage.count / leadCount) * 100))
            : stage.count && stage.count > 0
              ? 40
              : 8;
        return (
          <div
            key={stage.id}
            className={cn("flex items-center gap-4 py-2.5", index > 0 && "border-t border-dashed border-[#E9E2F0]")}
          >
            <div className="w-24 shrink-0 text-[13.5px] text-[#71667E]">{stage.name}</div>
            <div className="relative h-[30px] flex-1 overflow-hidden rounded-md bg-[#F1E7F8]">
              {stage.availability === "unavailable" ? (
                <span className="px-3 text-[13px] leading-[30px] text-[#71667E]">
                  {stage.reason ?? "No data"}
                </span>
              ) : (
                <div
                  className="flex h-full items-center rounded-md bg-[#4A2E6B] pl-3 text-[13px] font-semibold text-white"
                  style={{ width: `${width}%` }}
                >
                  {stage.count == null ? "—" : formatCount(stage.count)}
                </div>
              )}
            </div>
            <div className="w-[60px] shrink-0 text-right text-xs text-[#71667E]">
              {stage.id === "leads" ? "—" : formatPercent(stage.conversionFromPrevious)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CohortRow({ cohort }: { cohort: UpcomingCohortRow }) {
  const ratio =
    cohort.filled != null && cohort.capacity != null && cohort.capacity > 0
      ? Math.min(100, (cohort.filled / cohort.capacity) * 100)
      : null;
  return (
    <tr className="border-b border-[#E9E2F0] last:border-b-0">
      <td className="py-3.5">
        <div className="font-semibold">{cohort.name}</div>
        {cohort.subtitle ? <div className="text-[12.5px] text-[#71667E]">{cohort.subtitle}</div> : null}
      </td>
      <td className="py-3.5 text-[#71667E]">{formatDateUk(cohort.startsAt)}</td>
      <td className="py-3.5">
        {cohort.filled == null || cohort.capacity == null ? (
          <span className="text-[#71667E]">No seats data</span>
        ) : (
          <>
            {cohort.filled} / {cohort.capacity}
            <div className="mt-1.5 h-2 w-[120px] overflow-hidden rounded bg-[#F1E7F8]">
              <div
                className={cn("h-full rounded", ratio != null && ratio < 50 ? "bg-[#B8842A]" : "bg-[#4A2E6B]")}
                style={{ width: `${ratio ?? 0}%` }}
              />
            </div>
          </>
        )}
      </td>
      <td className="py-3.5">
        {cohort.status === "full"
          ? "—"
          : cohort.daysLeft == null
            ? "—"
            : `${cohort.daysLeft} left`}
      </td>
      <td className="py-3.5">
        <span className={cn("inline-block rounded-full px-2.5 py-1 text-xs font-semibold", pillClass[cohort.status])}>
          {cohort.statusLabel}
        </span>
      </td>
    </tr>
  );
}

function DiscrepancyTable({ rows }: { rows: CashDiscrepancyRow[] }) {
  const visible = rows.slice(0, 25);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-[#E9E2F0] text-left text-xs text-[#71667E]">
            <th className="pb-2 font-medium">Issue</th>
            <th className="pb-2 font-medium">Person</th>
            <th className="pb-2 font-medium">Stripe</th>
            <th className="pb-2 font-medium">Sales call log</th>
            <th className="pb-2 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row, index) => (
            <tr key={`${row.kind}-${row.email}-${index}`} className="border-b border-[#E9E2F0] last:border-b-0">
              <td className="py-2.5 font-medium">
                {row.kind === "stripe_only"
                  ? "Missing on log"
                  : row.kind === "notion_only"
                    ? "Missing in Stripe"
                    : "Amount mismatch"}
              </td>
              <td className="py-2.5">
                <div>{row.name ?? "—"}</div>
                <div className="text-[12px] text-[#71667E]">{row.email ?? "No email"}</div>
              </td>
              <td className="py-2.5">{formatPence(row.stripePence)}</td>
              <td className="py-2.5">{formatPence(row.notionPence)}</td>
              <td className="py-2.5 text-[#71667E]">{row.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 25 ? (
        <p className="mt-2 text-xs text-[#71667E]">Showing 25 of {rows.length} unmatched rows.</p>
      ) : null}
    </div>
  );
}
