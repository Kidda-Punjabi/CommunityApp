import { ymdInInclusiveRange } from "@/lib/admin/sales-report/date-range";
import { diagnoseSalesReport } from "@/lib/admin/sales-report/diagnosis";
import {
  collectedPounds,
  hasRecordedBalance,
  isLostOutcome,
  isOpenFollowUp,
  isOpenPipeline,
  isPaidInFull,
  leadSourceBucket,
  productLabel,
  salespersonKey,
} from "@/lib/admin/sales-report/mapping";
import type {
  AgingRow,
  ComparedNumber,
  DataQualityGap,
  FinancingFlagRow,
  FollowUpRow,
  FunnelBySourceRow,
  FunnelStageRow,
  LeadRecord,
  LostReasonRow,
  ProductBySalespersonRow,
  ProductMixRow,
  SalesCallRecord,
  SalespersonRow,
  SalesReport,
  SalesReportHeadline,
  SalesReportRange,
} from "@/lib/admin/sales-report/types";

const EMPTY_SALESPERSON: Omit<SalespersonRow, "name" | "revenueRank" | "discountingFlag"> = {
  callsBooked: 0,
  callsTaken: 0,
  callsClosed: 0,
  closeRate: null,
  cashOnCallCount: 0,
  cashOnCallPounds: 0,
  paidAfterwardsCount: 0,
  paidAfterwardsPounds: 0,
  aovClosed: 0,
  revenueCollected: 0,
  revenueBooked: 0,
  showRate: null,
};

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

function directionFromDelta(delta: number, flatEpsilon: number): "up" | "down" | "flat" {
  if (Math.abs(delta) <= flatEpsilon) return "flat";
  return delta > 0 ? "up" : "down";
}

function compared(
  current: number,
  previous: number | null,
  mtd: number | null,
  kind: "count" | "money" | "rate"
): ComparedNumber {
  const vsPreviousPct =
    previous != null && previous !== 0 && kind !== "rate"
      ? (current - previous) / Math.abs(previous)
      : null;
  const vsPreviousPts = previous != null && kind === "rate" ? current - previous : null;
  const vsMtdPct =
    mtd != null && mtd !== 0 && kind !== "rate" ? (current - mtd) / Math.abs(mtd) : null;
  const vsMtdPts = mtd != null && kind === "rate" ? current - mtd : null;
  return {
    current,
    previous,
    mtd,
    vsPreviousPct,
    vsPreviousPts,
    vsMtdPct,
    vsMtdPts,
    vsPreviousDirection:
      kind === "rate"
        ? directionFromDelta(vsPreviousPts ?? 0, 0.005)
        : directionFromDelta(vsPreviousPct ?? 0, 0.005),
    vsMtdDirection:
      kind === "rate"
        ? directionFromDelta(vsMtdPts ?? 0, 0.005)
        : directionFromDelta(vsMtdPct ?? 0, 0.005),
  };
}

function callInRange(call: SalesCallRecord, startYmd: string, endYmd: string): boolean {
  return ymdInInclusiveRange(call.callDate, startYmd, endYmd);
}

function paymentInRange(call: SalesCallRecord, startYmd: string, endYmd: string): boolean {
  return ymdInInclusiveRange(call.paymentDate, startYmd, endYmd);
}

function leadInRange(lead: LeadRecord, startYmd: string, endYmd: string): boolean {
  return ymdInInclusiveRange(lead.createdYmd, startYmd, endYmd);
}

function blankSalesperson(name: string): SalespersonRow {
  return {
    name,
    ...EMPTY_SALESPERSON,
    aovClosed: null,
    revenueRank: 0,
    discountingFlag: false,
  };
}

function accumulateSalespeople(
  calls: SalesCallRecord[],
  startYmd: string,
  endYmd: string
): Map<string, SalespersonRow> {
  const byName = new Map<string, SalespersonRow>();

  const rowFor = (name: string) => {
    const existing = byName.get(name);
    if (existing) return existing;
    const created = blankSalesperson(name);
    byName.set(name, created);
    return created;
  };

  for (const call of calls) {
    const name = salespersonKey(call.salespersonName);
    if (callInRange(call, startYmd, endYmd)) {
      const row = rowFor(name);
      row.callsBooked += 1;
      if (call.showUp) row.callsTaken += 1;
      if (call.closed) {
        row.callsClosed += 1;
        row.revenueBooked += collectedPounds(call.cashOnCall, call.paidAfterwards);
      }
    }
    if (paymentInRange(call, startYmd, endYmd)) {
      const row = rowFor(name);
      const onCall = collectedPounds(call.cashOnCall, 0);
      const afterwards = collectedPounds(0, call.paidAfterwards);
      row.revenueCollected += onCall + afterwards;
      if (onCall > 0) {
        row.cashOnCallCount += 1;
        row.cashOnCallPounds += onCall;
      }
      if (afterwards > 0) {
        row.paidAfterwardsCount += 1;
        row.paidAfterwardsPounds += afterwards;
      }
    }
  }

  for (const row of byName.values()) {
    row.closeRate = rate(row.callsClosed, row.callsTaken);
    row.showRate = rate(row.callsTaken, row.callsBooked);
    row.aovClosed = row.callsClosed > 0 ? row.revenueBooked / row.callsClosed : null;
  }

  return byName;
}

function totalsFrom(rows: SalespersonRow[], name = "Team"): SalespersonRow {
  const total = blankSalesperson(name);
  for (const row of rows) {
    total.callsBooked += row.callsBooked;
    total.callsTaken += row.callsTaken;
    total.callsClosed += row.callsClosed;
    total.cashOnCallCount += row.cashOnCallCount;
    total.cashOnCallPounds += row.cashOnCallPounds;
    total.paidAfterwardsCount += row.paidAfterwardsCount;
    total.paidAfterwardsPounds += row.paidAfterwardsPounds;
    total.revenueCollected += row.revenueCollected;
    total.revenueBooked += row.revenueBooked;
  }
  total.closeRate = rate(total.callsClosed, total.callsTaken);
  total.showRate = rate(total.callsTaken, total.callsBooked);
  total.aovClosed = total.callsClosed > 0 ? total.revenueBooked / total.callsClosed : null;
  total.revenueRank = 0;
  return total;
}

function rankSalespeople(rows: SalespersonRow[]): SalespersonRow[] {
  const ranked = [...rows].sort((a, b) => {
    if (b.revenueCollected !== a.revenueCollected) return b.revenueCollected - a.revenueCollected;
    return a.name.localeCompare(b.name);
  });
  ranked.forEach((row, index) => {
    row.revenueRank = index + 1;
  });
  const teamAov = totalsFrom(ranked).aovClosed;
  const teamClose = totalsFrom(ranked).closeRate;
  for (const row of ranked) {
    row.discountingFlag =
      row.closeRate != null &&
      teamClose != null &&
      row.aovClosed != null &&
      teamAov != null &&
      teamAov > 0 &&
      row.callsClosed >= 2 &&
      row.closeRate >= teamClose + 0.05 &&
      row.aovClosed < teamAov * 0.85;
  }
  return ranked;
}

function periodCounts(
  calls: SalesCallRecord[],
  leads: LeadRecord[],
  startYmd: string,
  endYmd: string
) {
  const periodCalls = calls.filter((call) => callInRange(call, startYmd, endYmd));
  const periodLeads = leads.filter((lead) => leadInRange(lead, startYmd, endYmd));
  const booked = periodCalls.length;
  const taken = periodCalls.filter((call) => call.showUp).length;
  const closed = periodCalls.filter((call) => call.closed).length;
  const revenueBooked = periodCalls
    .filter((call) => call.closed)
    .reduce((sum, call) => sum + collectedPounds(call.cashOnCall, call.paidAfterwards), 0);
  const revenueCollected = calls
    .filter((call) => paymentInRange(call, startYmd, endYmd))
    .reduce((sum, call) => sum + collectedPounds(call.cashOnCall, call.paidAfterwards), 0);
  return {
    leads: periodLeads.length,
    booked,
    taken,
    closed,
    revenueBooked,
    revenueCollected,
    closeRate: rate(closed, taken),
    bookingRate: rate(booked, periodLeads.length),
    showRate: rate(taken, booked),
  };
}

function funnelFor(
  calls: SalesCallRecord[],
  leads: LeadRecord[],
  startYmd: string,
  endYmd: string
): FunnelStageRow[] {
  const counts = periodCounts(calls, leads, startYmd, endYmd);
  const stages: Array<{ id: FunnelStageRow["id"]; name: string; count: number }> = [
    { id: "leads", name: "Leads generated", count: counts.leads },
    { id: "booked", name: "Booked", count: counts.booked },
    { id: "showed", name: "Showed", count: counts.taken },
    { id: "closed", name: "Closed", count: counts.closed },
  ];
  return stages.map((stage, index) => {
    const previous = index === 0 ? null : stages[index - 1].count;
    const dropOffFromPrevious =
      previous == null || previous <= 0 ? null : Math.max(0, 1 - stage.count / previous);
    return { ...stage, dropOffFromPrevious };
  });
}

function funnelBySource(
  calls: SalesCallRecord[],
  leads: LeadRecord[],
  startYmd: string,
  endYmd: string
): FunnelBySourceRow[] {
  const sourceByLeadId = new Map(leads.map((lead) => [lead.pageId, lead.leadSource]));
  const rows = new Map<string, FunnelBySourceRow>();

  const rowFor = (source: string | null): FunnelBySourceRow => {
    const label = source?.trim() || "Unknown";
    const existing = rows.get(label);
    if (existing) return existing;
    const created: FunnelBySourceRow = {
      source: label,
      bucket: leadSourceBucket(source),
      leads: 0,
      booked: 0,
      showed: 0,
      closed: 0,
    };
    rows.set(label, created);
    return created;
  };

  for (const lead of leads) {
    if (!leadInRange(lead, startYmd, endYmd)) continue;
    rowFor(lead.leadSource).leads += 1;
  }

  for (const call of calls) {
    if (!callInRange(call, startYmd, endYmd)) continue;
    const source = call.leadPageId ? sourceByLeadId.get(call.leadPageId) ?? null : null;
    const row = rowFor(source);
    row.booked += 1;
    if (call.showUp) row.showed += 1;
    if (call.closed) row.closed += 1;
  }

  return [...rows.values()].sort((a, b) => b.leads - a.leads || b.booked - a.booked);
}

function productMix(
  calls: SalesCallRecord[],
  startYmd: string,
  endYmd: string
): { products: ProductMixRow[]; bySalesperson: ProductBySalespersonRow[] } {
  const products = new Map<string, ProductMixRow>();
  const bySalesperson = new Map<string, ProductBySalespersonRow>();

  for (const call of calls) {
    if (!call.closed || !callInRange(call, startYmd, endYmd)) continue;
    const product = productLabel(call.course, call.delivery);
    const revenue = collectedPounds(call.cashOnCall, call.paidAfterwards);
    const mix = products.get(product) ?? {
      product,
      closedCount: 0,
      revenueCollected: 0,
      aov: null,
    };
    mix.closedCount += 1;
    mix.revenueCollected += revenue;
    products.set(product, mix);

    const salesperson = salespersonKey(call.salespersonName);
    const key = `${salesperson}::${product}`;
    const cross = bySalesperson.get(key) ?? {
      salesperson,
      product,
      closedCount: 0,
      revenueCollected: 0,
      aov: null,
    };
    cross.closedCount += 1;
    cross.revenueCollected += revenue;
    bySalesperson.set(key, cross);
  }

  const productRows = [...products.values()].map((row) => ({
    ...row,
    aov: row.closedCount > 0 ? row.revenueCollected / row.closedCount : null,
  }));
  productRows.sort((a, b) => b.revenueCollected - a.revenueCollected);

  const crossRows = [...bySalesperson.values()].map((row) => ({
    ...row,
    aov: row.closedCount > 0 ? row.revenueCollected / row.closedCount : null,
  }));
  crossRows.sort(
    (a, b) => a.salesperson.localeCompare(b.salesperson) || b.revenueCollected - a.revenueCollected
  );

  return { products: productRows, bySalesperson: crossRows };
}

function followUpsBySalesperson(calls: SalesCallRecord[]): FollowUpRow[] {
  const counts = new Map<string, number>();
  for (const call of calls) {
    if (!isOpenFollowUp(call.outcome, call.closed)) continue;
    const name = salespersonKey(call.salespersonName);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([salesperson, count]) => ({ salesperson, count }))
    .sort((a, b) => b.count - a.count || a.salesperson.localeCompare(b.salesperson));
}

function agingRows(calls: SalesCallRecord[], generatedAt: string, agingDays: number): AgingRow[] {
  const cutoff = new Date(generatedAt).getTime() - agingDays * 86_400_000;
  const rows: AgingRow[] = [];
  for (const call of calls) {
    if (!isOpenPipeline(call.outcome, call.closed)) continue;
    const touched = new Date(call.lastEditedTime).getTime();
    if (!Number.isFinite(touched) || touched > cutoff) continue;
    const daysSinceTouch = Math.max(0, Math.floor((Date.parse(generatedAt) - touched) / 86_400_000));
    rows.push({
      pageId: call.pageId,
      salesperson: salespersonKey(call.salespersonName),
      outcome: call.outcome,
      lastEditedTime: call.lastEditedTime,
      daysSinceTouch,
      notes: call.notes,
    });
  }
  rows.sort((a, b) => b.daysSinceTouch - a.daysSinceTouch);
  return rows;
}

function lostReasons(
  calls: SalesCallRecord[],
  startYmd: string,
  endYmd: string
): LostReasonRow[] {
  const counts = new Map<string, number>();
  for (const call of calls) {
    if (!callInRange(call, startYmd, endYmd)) continue;
    if (!isLostOutcome(call.outcome)) continue;
    const reason = call.outcome ?? "Unknown";
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

function financingFlags(
  calls: SalesCallRecord[],
  startYmd: string,
  endYmd: string
): FinancingFlagRow[] {
  const rows: FinancingFlagRow[] = [];
  for (const call of calls) {
    const inScope = callInRange(call, startYmd, endYmd) || paymentInRange(call, startYmd, endYmd);
    if (!inScope || !hasRecordedBalance(call.outstandingBalance)) continue;
    rows.push({
      pageId: call.pageId,
      salesperson: salespersonKey(call.salespersonName),
      outstandingBalance: call.outstandingBalance ?? 0,
      outBalStatus: call.outBalStatus,
      paymentDate: call.paymentDate,
      collectedPounds: collectedPounds(call.cashOnCall, call.paidAfterwards),
    });
  }
  return rows;
}

function dataQuality(
  calls: SalesCallRecord[],
  leads: LeadRecord[],
  startYmd: string,
  endYmd: string
): { hasGaps: boolean; summary: string; gaps: DataQualityGap[] } {
  const periodCalls = calls.filter(
    (call) => callInRange(call, startYmd, endYmd) || paymentInRange(call, startYmd, endYmd)
  );
  const periodLeads = leads.filter((lead) => leadInRange(lead, startYmd, endYmd));
  const gaps: DataQualityGap[] = [];

  const missingPerson = periodCalls.filter((call) => !call.salespersonName?.trim()).length;
  if (missingPerson > 0) {
    gaps.push({
      field: "Person (salesperson)",
      rowCount: missingPerson,
      note: "Sales Call Log Person people field was empty. Those rows are grouped as Unassigned.",
    });
  }

  const missingOutcome = periodCalls.filter((call) => !call.outcome?.trim()).length;
  if (missingOutcome > 0) {
    gaps.push({
      field: "Outcome",
      rowCount: missingOutcome,
      note: "Outcome was empty. Rows stay in booked/taken totals and are not treated as lost.",
    });
  }

  const closedMissingPayment = periodCalls.filter(
    (call) => call.closed && !call.paymentDate && collectedPounds(call.cashOnCall, call.paidAfterwards) > 0
  ).length;
  if (closedMissingPayment > 0) {
    gaps.push({
      field: "Payment Date",
      rowCount: closedMissingPayment,
      note: "Closed deals with cash recorded but no Payment Date. They count in booked revenue, not collected.",
    });
  }

  const closedMissingCourse = periodCalls.filter((call) => call.closed && !call.course?.trim()).length;
  if (closedMissingCourse > 0) {
    gaps.push({
      field: "Course",
      rowCount: closedMissingCourse,
      note: "Closed deals with no Course. They appear under Unspecified offer.",
    });
  }

  const multiPerson = periodCalls.filter((call) => call.salespersonCount > 1).length;
  if (multiPerson > 0) {
    gaps.push({
      field: "Person (multiple)",
      rowCount: multiPerson,
      note: "More than one Notion person on the call. Grouped by the first person listed.",
    });
  }

  const missingLeadSource = periodLeads.filter((lead) => !lead.leadSource?.trim()).length;
  if (missingLeadSource > 0) {
    gaps.push({
      field: "Lead Source",
      rowCount: missingLeadSource,
      note: "Leads generated in range with no Lead Source select value.",
    });
  }

  const closedNotPaidInFull = periodCalls.filter(
    (call) =>
      call.closed &&
      !isPaidInFull(call.outstandingBalance, call.outBalStatus) &&
      !hasRecordedBalance(call.outstandingBalance)
  ).length;
  if (closedNotPaidInFull > 0) {
    gaps.push({
      field: "Out Bal. Status",
      rowCount: closedNotPaidInFull,
      note: "Closed deals with Out Bal. Status filled but no outstanding balance amount. Not treated as financing.",
    });
  }

  const hasGaps = gaps.length > 0;
  const summary = hasGaps
    ? `${gaps.reduce((sum, gap) => sum + gap.rowCount, 0)} rows have unfilled fields in this range.`
    : "No data-quality gaps flagged for this range.";

  return { hasGaps, summary, gaps };
}

export function computeSalesReport(input: {
  range: SalesReportRange;
  generatedAt: string;
  agingDays: number;
  calls: SalesCallRecord[];
  leads: LeadRecord[];
  productCatalogueAvailable: boolean;
}): SalesReport {
  const { range, generatedAt, agingDays, calls, leads, productCatalogueAvailable } = input;
  const current = periodCounts(calls, leads, range.startYmd, range.endYmd);
  const previous = periodCounts(calls, leads, range.previousStartYmd, range.previousEndYmd);
  const mtd = periodCounts(calls, leads, range.mtdStartYmd, range.mtdEndYmd);

  const headline: SalesReportHeadline = {
    revenueCollected: compared(current.revenueCollected, previous.revenueCollected, mtd.revenueCollected, "money"),
    revenueBooked: compared(current.revenueBooked, previous.revenueBooked, mtd.revenueBooked, "money"),
    callsTaken: compared(current.taken, previous.taken, mtd.taken, "count"),
    callsClosed: compared(current.closed, previous.closed, mtd.closed, "count"),
    closeRate: compared(current.closeRate ?? 0, previous.closeRate, mtd.closeRate, "rate"),
    leadsIn: compared(current.leads, previous.leads, mtd.leads, "count"),
    callsBooked: compared(current.booked, previous.booked, mtd.booked, "count"),
    bookingRate: compared(current.bookingRate ?? 0, previous.bookingRate, mtd.bookingRate, "rate"),
    showRate: compared(current.showRate ?? 0, previous.showRate, mtd.showRate, "rate"),
  };

  const salespeople = rankSalespeople([
    ...accumulateSalespeople(calls, range.startYmd, range.endYmd).values(),
  ]);
  const teamTotals = totalsFrom(salespeople);
  const mix = productMix(calls, range.startYmd, range.endYmd);
  const funnelSources = funnelBySource(calls, leads, range.startYmd, range.endYmd);
  const sourcedLeads = leads.filter((lead) => leadInRange(lead, range.startYmd, range.endYmd));
  const filledSources = sourcedLeads.filter((lead) => lead.leadSource?.trim()).length;
  const leadSourceUseful = sourcedLeads.length > 0 && filledSources / sourcedLeads.length >= 0.4;
  const quality = dataQuality(calls, leads, range.startYmd, range.endYmd);
  const financing = financingFlags(calls, range.startYmd, range.endYmd);
  const previousPeople = rankSalespeople([
    ...accumulateSalespeople(calls, range.previousStartYmd, range.previousEndYmd).values(),
  ]);

  const report: SalesReport = {
    range,
    generatedAt,
    agingDays,
    headline,
    salespeople,
    teamTotals,
    funnel: funnelFor(calls, leads, range.startYmd, range.endYmd),
    funnelBySource: funnelSources,
    leadSourceUseful,
    leadSourceNote: leadSourceUseful
      ? "Lead Source on the Leads database is populated enough to split the funnel. Notion has no Referral option; Paid Social maps to Paid ad, Content and App Signup map to Organic, form names stay as Other."
      : "Lead Source is missing on most leads in this range, so the source split is shown as a data-quality warning rather than a reliable channel read.",
    products: mix.products,
    productBySalesperson: mix.bySalesperson,
    productCatalogueNote: productCatalogueAvailable
      ? "Offers mapped from the Product Catalogue."
      : "Product Catalogue is not shared with the Kidda App integration. Offers are mapped from Course and Delivery on the Sales Call Log (Beginner Group, 1-1, Foundational/Refresher, Community membership).",
    followUps: followUpsBySalesperson(calls),
    aging: agingRows(calls, generatedAt, agingDays),
    lostReasons: lostReasons(calls, range.startYmd, range.endYmd),
    lostReasonNote:
      "There is no separate lost-reason field. Lost deals use Outcome values Can't Afford, Not Interested, Cancelled, and Refunded. Price, timing, no response, and chose competitor are not logged as options.",
    financingFlags: financing,
    dataQuality: quality,
    diagnosis: [],
    sourceStats: {
      salesCallPages: calls.length,
      leadPages: leads.length,
      fetchedAt: generatedAt,
    },
  };

  report.diagnosis = diagnoseSalesReport(report, previousPeople);
  return report;
}
