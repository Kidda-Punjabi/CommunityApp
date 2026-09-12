import "server-only";

import { computeSalesReport } from "@/lib/admin/sales-report/compute";
import { resolveSalesReportRange } from "@/lib/admin/sales-report/date-range";
import { fetchSalesReportNotionData } from "@/lib/admin/sales-report/notion";
import type {
  SalesReport,
  SalesReportListItem,
  SalesReportPreset,
} from "@/lib/admin/sales-report/types";
import { SALES_REPORT_PRESETS } from "@/lib/admin/sales-report/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export function parseSalesReportPreset(value: string | null | undefined): SalesReportPreset {
  if (value && SALES_REPORT_PRESETS.includes(value as SalesReportPreset)) {
    return value as SalesReportPreset;
  }
  return "last_week";
}

export async function generateAcquisitionSalesReport(
  supabase: SupabaseClient,
  input: {
    preset: SalesReportPreset;
    from?: string;
    to?: string;
    agingDays?: number;
    generatedBy?: string | null;
  }
): Promise<{ id: string; report: SalesReport }> {
  const agingDays = Math.min(30, Math.max(1, input.agingDays ?? 7));
  const range = resolveSalesReportRange(input.preset, new Date(), {
    from: input.from ?? "",
    to: input.to ?? "",
  });
  const fetched = await fetchSalesReportNotionData(range);
  const generatedAt = new Date().toISOString();
  const report = computeSalesReport({
    range,
    generatedAt,
    agingDays,
    calls: fetched.calls,
    leads: fetched.leads,
    productCatalogueAvailable: fetched.productCatalogueAvailable,
  });
  report.sourceStats.fetchedAt = fetched.fetchedAt;
  report.sourceStats.salesCallPages = fetched.calls.length;
  report.sourceStats.leadPages = fetched.leads.length;

  const { data, error } = await supabase
    .from("acquisition_sales_reports")
    .insert({
      range_preset: range.preset,
      range_start: range.startYmd,
      range_end: range.endYmd,
      range_label: range.label,
      aging_days: agingDays,
      generated_at: generatedAt,
      generated_by: input.generatedBy ?? null,
      source_fetched_at: fetched.fetchedAt,
      notion_call_pages: fetched.calls.length,
      notion_lead_pages: fetched.leads.length,
      report,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "Failed to persist sales report.");
  }

  return { id: data.id, report };
}

export async function getAcquisitionSalesReport(
  supabase: SupabaseClient,
  id: string
): Promise<SalesReport | null> {
  const { data, error } = await supabase
    .from("acquisition_sales_reports")
    .select("report")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.report as SalesReport | null) ?? null;
}

export async function listAcquisitionSalesReports(
  supabase: SupabaseClient,
  limit = 20
): Promise<SalesReportListItem[]> {
  const { data, error } = await supabase
    .from("acquisition_sales_reports")
    .select("id, range_preset, range_start, range_end, range_label, generated_at, aging_days")
    .order("generated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    rangePreset: row.range_preset as SalesReportPreset,
    rangeStart: row.range_start,
    rangeEnd: row.range_end,
    rangeLabel: row.range_label,
    generatedAt: row.generated_at,
    agingDays: row.aging_days,
  }));
}
