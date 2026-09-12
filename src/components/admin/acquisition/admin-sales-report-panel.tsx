"use client";

import type {
  ComparedNumber,
  SalesReport,
  SalesReportListItem,
  SalesReportPreset,
  SalespersonRow,
} from "@/lib/admin/sales-report/types";
import {
  comparisonHint,
  formatCount,
  formatPercent,
  formatPounds,
  formatWhen,
  mtdHint,
} from "@/lib/admin/sales-report/format";
import { cn } from "@/lib/ui/styles";
import { useCallback, useEffect, useMemo, useState } from "react";

const PRESETS: Array<{ id: SalesReportPreset; label: string }> = [
  { id: "this_week", label: "This week" },
  { id: "last_week", label: "Last week" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "custom", label: "Custom" },
];

type SortKey = keyof Pick<
  SalespersonRow,
  | "name"
  | "callsBooked"
  | "callsTaken"
  | "callsClosed"
  | "closeRate"
  | "showRate"
  | "aovClosed"
  | "revenueCollected"
  | "revenueRank"
>;

function toneClass(direction: ComparedNumber["vsPreviousDirection"]) {
  if (direction === "up") return "text-[#2F6B4F]";
  if (direction === "down") return "text-[#AE4335]";
  return "text-[#71667E]";
}

export function AdminSalesReportPanel() {
  const [preset, setPreset] = useState<SalesReportPreset>("last_week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [agingDays, setAgingDays] = useState(7);
  const [reportId, setReportId] = useState<string | null>(null);
  const [report, setReport] = useState<SalesReport | null>(null);
  const [past, setPast] = useState<SalesReportListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loadingPast, setLoadingPast] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("revenueRank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const loadPast = useCallback(async () => {
    setLoadingPast(true);
    try {
      const response = await fetch("/api/admin/sales-report", { cache: "no-store" });
      const payload = (await response.json()) as { reports?: SalesReportListItem[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Failed to load past reports.");
      setPast(payload.reports ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load past reports.");
    } finally {
      setLoadingPast(false);
    }
  }, []);

  useEffect(() => {
    void loadPast();
  }, [loadPast]);

  const openReport = useCallback(async (id: string) => {
    setError(null);
    const response = await fetch(`/api/admin/sales-report?id=${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    const payload = (await response.json()) as { report?: SalesReport; error?: string };
    if (!response.ok || !payload.report) {
      setError(payload.error ?? "Could not reopen that report.");
      return;
    }
    setReportId(id);
    setReport(payload.report);
  }, []);

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/sales-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preset,
          from: customFrom,
          to: customTo,
          agingDays,
        }),
        signal: AbortSignal.timeout(240_000),
      });
      const payload = (await response.json()) as {
        id?: string;
        report?: SalesReport;
        error?: string;
      };
      if (!response.ok || !payload.id || !payload.report) {
        throw new Error(payload.error ?? "Failed to generate sales report.");
      }
      setReportId(payload.id);
      setReport(payload.report);
      await loadPast();
      const verify = await fetch(`/api/admin/sales-report?id=${encodeURIComponent(payload.id)}`, {
        cache: "no-store",
      });
      const verified = (await verify.json()) as { report?: SalesReport };
      if (!verify.ok || !verified.report) {
        throw new Error("Report generated but could not be re-fetched from storage.");
      }
    } catch (generateError) {
      const name = generateError instanceof Error ? generateError.name : "";
      if (name === "TimeoutError" || name === "AbortError") {
        setError("Generate timed out. Notion may be rate-limiting; wait a minute and try again.");
      } else {
        setError(
          generateError instanceof Error ? generateError.message : "Failed to generate sales report."
        );
      }
    } finally {
      setGenerating(false);
    }
  }, [agingDays, customFrom, customTo, loadPast, preset]);

  const sortedPeople = useMemo(() => {
    if (!report) return [];
    const rows = [...report.salespeople];
    rows.sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];
      if (left == null && right == null) return 0;
      if (left == null) return 1;
      if (right == null) return -1;
      if (typeof left === "string" && typeof right === "string") {
        return sortDir === "asc" ? left.localeCompare(right) : right.localeCompare(left);
      }
      const delta = Number(left) - Number(right);
      return sortDir === "asc" ? delta : -delta;
    });
    return rows;
  }, [report, sortDir, sortKey]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "name" ? "asc" : "desc");
  }

  return (
    <section className="rounded-xl border border-[#E9E2F0] bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-[17px] font-semibold">Sales report</h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[#71667E]">
            Generate a snapshot for any range. Notion is queried only when you click Generate.
            Each run is saved so you can reopen last Wednesday&apos;s review without hitting the
            API again.
          </p>
        </div>
        {reportId ? (
          <a
            href={`/api/admin/sales-report/${reportId}/pdf`}
            className="rounded-md border border-[#E9E2F0] px-3 py-1.5 text-sm font-semibold text-[#4A2E6B]"
          >
            Download PDF
          </a>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex overflow-hidden rounded-[9px] border border-[#E9E2F0] text-[13.5px]">
          {PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPreset(item.id)}
              className={cn(
                "px-3.5 py-2 font-medium",
                preset === item.id ? "bg-[#4A2E6B] text-white" : "text-[#71667E]"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        {preset === "custom" ? (
          <>
            <label className="text-xs text-[#71667E]">
              Start
              <input
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
                className="mt-1 block rounded-md border border-[#E9E2F0] px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-[#71667E]">
              End
              <input
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
                className="mt-1 block rounded-md border border-[#E9E2F0] px-2 py-1.5 text-sm"
              />
            </label>
          </>
        ) : null}
        <label className="text-xs text-[#71667E]">
          Aging days
          <input
            type="number"
            min={1}
            max={30}
            value={agingDays}
            onChange={(event) => setAgingDays(Number(event.target.value) || 7)}
            className="mt-1 block w-20 rounded-md border border-[#E9E2F0] px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={generating}
          className="rounded-md bg-[#4A2E6B] px-3.5 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {generating ? "Generating (this can take a minute)..." : "Generate report"}
        </button>
      </div>

      <div className="mt-3">
        <p className="text-xs font-medium text-[#71667E]">Past reports</p>
        {loadingPast ? (
          <p className="mt-1 text-xs text-[#71667E]">Loading saved reports...</p>
        ) : past.length === 0 ? (
          <p className="mt-1 text-xs text-[#71667E]">None yet. Generate one to start the archive.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {past.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void openReport(item.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium",
                  reportId === item.id
                    ? "border-[#4A2E6B] bg-[#F1E7F8] text-[#4A2E6B]"
                    : "border-[#E9E2F0] text-[#71667E]"
                )}
              >
                {item.rangeLabel} · {formatWhen(item.generatedAt)}
              </button>
            ))}
          </div>
        )}
      </div>

      {error ? (
        <p className="mt-4 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </p>
      ) : null}

      {report ? (
        <div className="mt-6 space-y-6">
          <p className="text-[13px] text-[#71667E]">
            {report.range.label}. Snapshot taken {formatWhen(report.generatedAt)}. Weekends are
            Monday to Sunday. Revenue collected uses Payment Date.
          </p>

          {report.dataQuality.hasGaps ? (
            <div className="rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm font-semibold text-amber-950">Data quality</p>
              <p className="mt-1 text-sm text-amber-900">{report.dataQuality.summary}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-amber-900">
                {report.dataQuality.gaps.map((gap) => (
                  <li key={gap.field}>
                    {gap.field}: {gap.rowCount} rows. {gap.note}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[13px] text-[#2F6B4F]">{report.dataQuality.summary}</p>
          )}

          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            <HeadlineCard
              label="Revenue collected"
              value={formatPounds(report.headline.revenueCollected.current)}
              previous={comparisonHint(report.headline.revenueCollected, "money")}
              mtd={mtdHint(report.headline.revenueCollected, "money")}
              tone={report.headline.revenueCollected.vsPreviousDirection}
            />
            <HeadlineCard
              label="Revenue booked"
              value={formatPounds(report.headline.revenueBooked.current)}
              previous={comparisonHint(report.headline.revenueBooked, "money")}
              mtd={mtdHint(report.headline.revenueBooked, "money")}
              tone={report.headline.revenueBooked.vsPreviousDirection}
            />
            <HeadlineCard
              label="Close rate"
              value={formatPercent(report.headline.closeRate.current)}
              previous={`${formatCount(report.headline.callsClosed.current)} closed / ${formatCount(report.headline.callsTaken.current)} taken · ${comparisonHint(report.headline.closeRate, "rate")}`}
              mtd={mtdHint(report.headline.closeRate, "rate")}
              tone={report.headline.closeRate.vsPreviousDirection}
            />
            <HeadlineCard
              label="Show rate"
              value={formatPercent(report.headline.showRate.current)}
              previous={`${formatCount(report.headline.callsTaken.current)} showed / ${formatCount(report.headline.callsBooked.current)} booked · ${comparisonHint(report.headline.showRate, "rate")}`}
              mtd={mtdHint(report.headline.showRate, "rate")}
              tone={report.headline.showRate.vsPreviousDirection}
            />
            <HeadlineCard
              label="Booking rate"
              value={formatPercent(report.headline.bookingRate.current)}
              previous={`${formatCount(report.headline.callsBooked.current)} booked / ${formatCount(report.headline.leadsIn.current)} leads · ${comparisonHint(report.headline.bookingRate, "rate")}`}
              mtd={mtdHint(report.headline.bookingRate, "rate")}
              tone={report.headline.bookingRate.vsPreviousDirection}
            />
          </div>

          <section>
            <h3 className="font-heading text-[15px] font-semibold">Per salesperson</h3>
            <p className="mb-3 mt-1 text-[13px] text-[#71667E]">
              Names come from the Sales Call Log Person field for this range. Cash on Call vs Paid
              Afterwards is closing-on-the-call vs follow-up, not instalments.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-[#E9E2F0] text-left text-xs text-[#71667E]">
                    {(
                      [
                        ["name", "Salesperson"],
                        ["callsBooked", "Booked"],
                        ["callsTaken", "Taken"],
                        ["callsClosed", "Closed"],
                        ["closeRate", "Close %"],
                        ["showRate", "Show %"],
                        ["aovClosed", "AOV"],
                        ["revenueCollected", "Collected"],
                        ["revenueRank", "Rank"],
                      ] as Array<[SortKey, string]>
                    ).map(([key, label]) => (
                      <th key={key} className="pb-2 font-medium">
                        <button type="button" onClick={() => toggleSort(key)} className="text-left">
                          {label}
                          {sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedPeople.map((row) => (
                    <SalespersonTableRow key={row.name} row={row} />
                  ))}
                  <SalespersonTableRow row={report.teamTotals} team />
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="font-heading text-[15px] font-semibold">Funnel / lead quality</h3>
            <p className="mb-3 mt-1 text-[13px] text-[#71667E]">
              Period activity, not a single-lead cohort. Booked can include leads created before
              this range. {report.leadSourceNote}
            </p>
            <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
              <div className="space-y-2">
                {report.funnel.map((stage) => (
                  <div key={stage.id} className="flex items-center justify-between text-sm">
                    <span className="text-[#71667E]">{stage.name}</span>
                    <span className="font-semibold">
                      {formatCount(stage.count)}
                      {stage.dropOffFromPrevious != null
                        ? `  · drop-off ${formatPercent(stage.dropOffFromPrevious)}`
                        : ""}
                    </span>
                  </div>
                ))}
              </div>
              {report.leadSourceUseful ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[13px]">
                    <thead>
                      <tr className="border-b border-[#E9E2F0] text-left text-xs text-[#71667E]">
                        <th className="pb-2 font-medium">Source</th>
                        <th className="pb-2 font-medium">Bucket</th>
                        <th className="pb-2 font-medium">Leads</th>
                        <th className="pb-2 font-medium">Booked</th>
                        <th className="pb-2 font-medium">Showed</th>
                        <th className="pb-2 font-medium">Closed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.funnelBySource.map((row) => (
                        <tr key={row.source} className="border-b border-[#E9E2F0] last:border-b-0">
                          <td className="py-2">{row.source}</td>
                          <td className="py-2 text-[#71667E]">{row.bucket}</td>
                          <td className="py-2">{row.leads}</td>
                          <td className="py-2">{row.booked}</td>
                          <td className="py-2">{row.showed}</td>
                          <td className="py-2">{row.closed}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-[#71667E]">{report.leadSourceNote}</p>
              )}
            </div>
          </section>

          <section>
            <h3 className="font-heading text-[15px] font-semibold">Offer mix</h3>
            <p className="mb-3 mt-1 text-[13px] text-[#71667E]">{report.productCatalogueNote}</p>
            <div className="grid gap-4 lg:grid-cols-2">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-[#E9E2F0] text-left text-xs text-[#71667E]">
                    <th className="pb-2 font-medium">Offer</th>
                    <th className="pb-2 font-medium">Closed</th>
                    <th className="pb-2 font-medium">Revenue</th>
                    <th className="pb-2 font-medium">AOV</th>
                  </tr>
                </thead>
                <tbody>
                  {report.products.map((row) => (
                    <tr key={row.product} className="border-b border-[#E9E2F0] last:border-b-0">
                      <td className="py-2">{row.product}</td>
                      <td className="py-2">{row.closedCount}</td>
                      <td className="py-2">{formatPounds(row.revenueCollected)}</td>
                      <td className="py-2">{formatPounds(row.aov)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-[#E9E2F0] text-left text-xs text-[#71667E]">
                    <th className="pb-2 font-medium">Salesperson</th>
                    <th className="pb-2 font-medium">Offer</th>
                    <th className="pb-2 font-medium">Closed</th>
                    <th className="pb-2 font-medium">AOV</th>
                  </tr>
                </thead>
                <tbody>
                  {report.productBySalesperson.map((row) => (
                    <tr
                      key={`${row.salesperson}-${row.product}`}
                      className="border-b border-[#E9E2F0] last:border-b-0"
                    >
                      <td className="py-2">{row.salesperson}</td>
                      <td className="py-2">{row.product}</td>
                      <td className="py-2">{row.closedCount}</td>
                      <td className="py-2">{formatPounds(row.aov)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {report.salespeople.some((row) => row.discountingFlag) ? (
              <p className="mt-3 text-sm text-[#AE4335]">
                High close rate with lower AOV flagged on{" "}
                {report.salespeople
                  .filter((row) => row.discountingFlag)
                  .map((row) => row.name)
                  .join(", ")}
                .
              </p>
            ) : null}
          </section>

          <section>
            <h3 className="font-heading text-[15px] font-semibold">Pipeline health</h3>
            <p className="mb-3 mt-1 text-[13px] text-[#71667E]">
              Open follow-ups and aging are as of generation time, not limited to the selected
              range. {report.lostReasonNote}
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              <div>
                <p className="text-xs font-medium text-[#71667E]">Open follow-ups</p>
                {report.followUps.length === 0 ? (
                  <p className="mt-2 text-sm text-[#71667E]">None open.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm">
                    {report.followUps.map((row) => (
                      <li key={row.salesperson} className="flex justify-between gap-3">
                        <span>{row.salesperson}</span>
                        <span className="font-semibold">{row.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-[#71667E]">
                  No touch in {report.agingDays} days
                </p>
                {report.aging.length === 0 ? (
                  <p className="mt-2 text-sm text-[#71667E]">None.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm">
                    {report.aging.slice(0, 8).map((row) => (
                      <li key={row.pageId}>
                        {row.salesperson} · {row.outcome ?? "No outcome"} · {row.daysSinceTouch}d
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-[#71667E]">Lost in range</p>
                {report.lostReasons.length === 0 ? (
                  <p className="mt-2 text-sm text-[#71667E]">No lost outcomes logged.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm">
                    {report.lostReasons.map((row) => (
                      <li key={row.reason} className="flex justify-between gap-3">
                        <span>{row.reason}</span>
                        <span className="font-semibold">{row.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            {report.financingFlags.length > 0 ? (
              <p className="mt-3 text-sm text-[#B8842A]">
                {report.financingFlags.length} deal
                {report.financingFlags.length === 1 ? "" : "s"} with a recorded outstanding
                balance (manual financing). Counted in closed/collected, flagged here rather than
                dropped.
              </p>
            ) : null}
          </section>

          <section>
            <h3 className="font-heading text-[15px] font-semibold">Diagnosis</h3>
            <ul className="mt-2 space-y-2 text-sm leading-relaxed text-[#241934]">
              {report.diagnosis.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function HeadlineCard({
  label,
  value,
  previous,
  mtd,
  tone,
}: {
  label: string;
  value: string;
  previous: string;
  mtd: string;
  tone: ComparedNumber["vsPreviousDirection"];
}) {
  return (
    <div className="rounded-lg border-l-[3px] border-[#4A2E6B] bg-[#FBF9FD] px-[18px] py-4">
      <p className="mb-2.5 text-[12.5px] font-medium text-[#71667E]">{label}</p>
      <p className="mb-2 font-heading text-[26px] font-semibold leading-none">{value}</p>
      <p className={cn("text-[12.5px] font-semibold", toneClass(tone))}>{previous}</p>
      <p className="mt-0.5 text-[12px] text-[#71667E]">{mtd}</p>
    </div>
  );
}

function SalespersonTableRow({ row, team }: { row: SalespersonRow; team?: boolean }) {
  return (
    <tr className={cn("border-b border-[#E9E2F0] last:border-b-0", team && "bg-[#F8F5FB] font-semibold")}>
      <td className="py-2.5">
        {row.name}
        {row.discountingFlag ? (
          <span className="ml-2 text-[11px] font-medium text-[#AE4335]">low AOV</span>
        ) : null}
      </td>
      <td className="py-2.5">{row.callsBooked}</td>
      <td className="py-2.5">{row.callsTaken}</td>
      <td className="py-2.5">{row.callsClosed}</td>
      <td className="py-2.5">{formatPercent(row.closeRate)}</td>
      <td className="py-2.5">{formatPercent(row.showRate)}</td>
      <td className="py-2.5">{formatPounds(row.aovClosed)}</td>
      <td className="py-2.5">
        {formatPounds(row.revenueCollected)}
        <div className="text-[11px] font-normal text-[#71667E]">
          on call {formatPounds(row.cashOnCallPounds)} · later {formatPounds(row.paidAfterwardsPounds)}
        </div>
      </td>
      <td className="py-2.5">{team ? "-" : `#${row.revenueRank}`}</td>
    </tr>
  );
}
