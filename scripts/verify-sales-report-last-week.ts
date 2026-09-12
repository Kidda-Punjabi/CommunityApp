/**
 * Independent last-week sales report check against live Notion + Supabase.
 * Not imported by the app.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { computeSalesReport } from "../src/lib/admin/sales-report/compute";
import { resolveSalesReportRange, ymdInInclusiveRange } from "../src/lib/admin/sales-report/date-range";
import { collectedPounds } from "../src/lib/admin/sales-report/mapping";
import { fetchSalesReportNotionData } from "../src/lib/admin/sales-report/notion";
import type { SalesReport } from "../src/lib/admin/sales-report/types";

function loadEnvFile(filename: string) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(".env.local");

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const range = resolveSalesReportRange("last_week", new Date("2026-09-12T12:00:00.000Z"));
  const fetched = await fetchSalesReportNotionData(range);
  const generatedAt = new Date().toISOString();
  const report = computeSalesReport({
    range,
    generatedAt,
    agingDays: 7,
    calls: fetched.calls,
    leads: fetched.leads,
    productCatalogueAvailable: fetched.productCatalogueAvailable,
  });

  const independentCollected = fetched.calls
    .filter((call) => ymdInInclusiveRange(call.paymentDate, range.startYmd, range.endYmd))
    .reduce((sum, call) => sum + collectedPounds(call.cashOnCall, call.paidAfterwards), 0);

  const namedPerson = report.salespeople.find((row) => row.name !== "Unassigned") ?? report.salespeople[0];
  const named = fetched.calls.filter(
    (call) =>
      ymdInInclusiveRange(call.callDate, range.startYmd, range.endYmd) &&
      (namedPerson ? call.salespersonName === namedPerson.name : false)
  );
  const taken = named.filter((call) => call.showUp).length;
  const closed = named.filter((call) => call.closed).length;
  const handPerson = namedPerson;

  const missing = {
    person: fetched.calls.filter(
      (call) =>
        (ymdInInclusiveRange(call.callDate, range.startYmd, range.endYmd) ||
          ymdInInclusiveRange(call.paymentDate, range.startYmd, range.endYmd)) &&
        !call.salespersonName
    ).length,
    outcome: fetched.calls.filter(
      (call) =>
        (ymdInInclusiveRange(call.callDate, range.startYmd, range.endYmd) ||
          ymdInInclusiveRange(call.paymentDate, range.startYmd, range.endYmd)) &&
        !call.outcome
    ).length,
  };

  const { data, error } = await supabase
    .from("acquisition_sales_reports")
    .insert({
      range_preset: range.preset,
      range_start: range.startYmd,
      range_end: range.endYmd,
      range_label: range.label,
      aging_days: 7,
      generated_at: generatedAt,
      generated_by: null,
      source_fetched_at: fetched.fetchedAt,
      notion_call_pages: fetched.calls.length,
      notion_lead_pages: fetched.leads.length,
      report,
    })
    .select("id")
    .single();
  if (error || !data?.id) throw new Error(error?.message ?? "persist failed");

  const { data: refetchedRow, error: refetchError } = await supabase
    .from("acquisition_sales_reports")
    .select("report")
    .eq("id", data.id)
    .maybeSingle();
  if (refetchError) throw new Error(refetchError.message);
  const refetched = (refetchedRow?.report as SalesReport | null) ?? null;
  if (!refetched) throw new Error("re-fetch returned null");

  const checks = {
    range: `${range.startYmd} to ${range.endYmd}`,
    collectedMatches:
      Math.abs(report.headline.revenueCollected.current - independentCollected) < 0.01,
    collected: report.headline.revenueCollected.current,
    independentCollected,
    booked: report.headline.revenueBooked.current,
    adnanCloseRateMatches: handPerson ? handPerson.callsTaken === taken && handPerson.callsClosed === closed : false,
    adnan: handPerson
      ? {
          name: handPerson.name,
          taken: handPerson.callsTaken,
          closed: handPerson.callsClosed,
          closeRate: handPerson.closeRate,
          handTaken: taken,
          handClosed: closed,
        }
      : null,
    dataQualityFired: report.dataQuality.hasGaps || missing.person + missing.outcome === 0,
    missing,
    gaps: report.dataQuality.gaps,
    persistedId: data.id,
    refetchCollected: refetched.headline.revenueCollected.current,
    refetchMatchesGenerate: refetched.headline.revenueCollected.current === report.headline.revenueCollected.current,
    salespeople: report.salespeople.map((row) => ({
      name: row.name,
      taken: row.callsTaken,
      closed: row.callsClosed,
      collected: row.revenueCollected,
    })),
    diagnosis: report.diagnosis,
  };

  console.log(JSON.stringify(checks, null, 2));
  if (!checks.collectedMatches || !checks.adnanCloseRateMatches || !checks.refetchMatchesGenerate) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
