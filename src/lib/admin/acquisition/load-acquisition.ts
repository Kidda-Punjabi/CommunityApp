import "server-only";

import {
  resolveAcquisitionRange,
  inRange,
  type ResolvedAcquisitionRange,
} from "@/lib/admin/acquisition/date-range";
import {
  averageCycleDays,
  cashBucketFromCheckoutKey,
  cohortFillStatus,
  conversionFromPrevious,
  countMetric,
  isTestCohortName,
  isUnworkedPipelineStage,
  matchCashDiscrepancy,
  moneyMetric,
  msToDays,
  penceToPounds,
  poundsToPence,
  rateMetric,
  salesVelocityPoundsPerDay,
  shortCohortLabel,
  timeToFillDays,
  type MatchablePayment,
} from "@/lib/admin/acquisition/metrics";
import type {
  AcquisitionRangeId,
  AcquisitionSnapshot,
  AcquisitionSourceSync,
  CashBreakdown,
  FunnelStage,
  UpcomingCohortRow,
} from "@/lib/admin/acquisition/types";
import { weekdayNameInTimezone, UK_DISPLAY_TIMEZONE } from "@/lib/calendar/uk-display-time";
import { GhlApiError } from "@/lib/ghl/client";
import {
  listGhlSalesPipelines,
  searchGhlOpportunities,
  type GhlPipeline,
} from "@/lib/ghl/opportunities";
import { NOTION_LEADS_DATA_SOURCE_ID, notionJson } from "@/lib/notion/client";
import { CHECKOUT_CONFIGS } from "@/lib/products/checkout";
import type { SupabaseClient } from "@supabase/supabase-js";

type SalesCallRow = {
  id: string;
  call_date: string | null;
  payment_date: string | null;
  show_up: boolean;
  closed: boolean;
  cash_on_call: number | null;
  paid_afterwards: number | null;
  lead_notion_page_id: string | null;
  notes: string | null;
};

type StripeEventRow = {
  id: string;
  event_type: string;
  received_at: string;
  checkout_session_id: string | null;
  payload_summary: Record<string, unknown> | null;
  raw_payload: Record<string, unknown> | null;
};

type ClassifiedStripePayment = MatchablePayment & {
  date: string;
  bucket: "group" | "one_to_one" | "community" | "other";
};

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function countNotionLeadsCreated(
  start: Date,
  end: Date,
  signal?: AbortSignal
): Promise<number> {
  let count = 0;
  let cursor: string | null = null;
  do {
    if (signal?.aborted) throw new Error("Notion request timed out");
    const body: Record<string, unknown> = {
      page_size: 100,
      filter: {
        and: [
          { timestamp: "created_time", created_time: { on_or_after: start.toISOString() } },
          { timestamp: "created_time", created_time: { on_or_before: end.toISOString() } },
        ],
      },
    };
    if (cursor) body.start_cursor = cursor;
    const timeout = AbortSignal.timeout(8000);
    const requestSignal =
      signal && typeof AbortSignal.any === "function"
        ? AbortSignal.any([signal, timeout])
        : (signal ?? timeout);
    const data = await notionJson<{
      results: unknown[];
      has_more: boolean;
      next_cursor: string | null;
    }>(`/databases/${NOTION_LEADS_DATA_SOURCE_ID}/query`, {
      method: "POST",
      body: JSON.stringify(body),
      signal: requestSignal,
      cache: "no-store",
    });
    count += data.results.length;
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return count;
}

async function fetchSalesCalls(
  supabase: SupabaseClient,
  fromIso: string
): Promise<SalesCallRow[]> {
  const pageSize = 1000;
  const byId = new Map<string, SalesCallRow>();

  async function page(column: "call_date" | "payment_date") {
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from("sales_calls")
        .select(
          "id, call_date, payment_date, show_up, closed, cash_on_call, paid_afterwards, lead_notion_page_id, notes"
        )
        .gte(column, fromIso)
        .range(offset, offset + pageSize - 1);
      if (error) throw new Error(error.message);
      const batch = (data ?? []) as SalesCallRow[];
      for (const row of batch) byId.set(row.id, row);
      if (batch.length < pageSize) break;
      offset += pageSize;
    }
  }

  await Promise.all([page("call_date"), page("payment_date")]);
  return [...byId.values()];
}

async function fetchStripeEvents(
  supabase: SupabaseClient,
  fromIso: string,
  toIso: string
): Promise<StripeEventRow[]> {
  const pageSize = 1000;
  const rows: StripeEventRow[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("stripe_webhook_events")
      .select("id, event_type, received_at, checkout_session_id, payload_summary, raw_payload")
      .in("event_type", ["checkout.session.completed", "invoice.paid"])
      .gte("received_at", fromIso)
      .lte("received_at", toIso)
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as StripeEventRow[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

function paymentLinkIdFromUnknown(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.match(/plink_[A-Za-z0-9]+/);
  return match?.[0] ?? null;
}

function checkoutKeyFromEnvPaymentLink(plinkId: string | null): string | null {
  if (!plinkId) return null;
  for (const config of CHECKOUT_CONFIGS) {
    const raw = process.env[config.paymentLinkEnv]?.trim() ?? "";
    if (raw.includes(plinkId)) return config.key;
  }
  const oneToOne = process.env.STRIPE_PAYMENT_LINK_ONE_TO_ONE_SESSION_PLINK_ID?.trim();
  if (oneToOne === plinkId) return "one-to-one-session";
  return null;
}

function classifyStripeEvents(events: StripeEventRow[]): ClassifiedStripePayment[] {
  const checkout = events.filter((event) => event.event_type === "checkout.session.completed");
  const invoices = events.filter((event) => event.event_type === "invoice.paid");
  const payments: ClassifiedStripePayment[] = [];
  const seenSessions = new Set<string>();

  for (const event of checkout) {
    const summary = event.payload_summary ?? {};
    const raw = event.raw_payload ?? {};
    const paymentStatus = readString(summary.payment_status) ?? readString(raw.payment_status);
    const status = readString(summary.status) ?? readString(raw.status);
    const paid = paymentStatus === "paid" || status === "complete";
    if (!paid) continue;
    const amount =
      readNumber(summary.amount_total) ?? readNumber(raw.amount_total) ?? 0;
    if (amount <= 0) continue;
    const sessionId =
      event.checkout_session_id ||
      readString(summary.session_id) ||
      readString(raw.id) ||
      event.id;
    if (seenSessions.has(sessionId)) continue;
    seenSessions.add(sessionId);

    const mode = readString(raw.mode);
    const checkoutKey =
      readString(summary.checkout_key) ||
      readString((raw.metadata as Record<string, unknown> | undefined)?.checkout_key);
    const bookingId =
      readString(summary.one_to_one_booking_id) ||
      readString((raw.metadata as Record<string, unknown> | undefined)?.one_to_one_booking_id);
    const plink = paymentLinkIdFromUnknown(summary.payment_link) ?? paymentLinkIdFromUnknown(raw.payment_link);
    const fromLink = checkoutKeyFromEnvPaymentLink(plink);
    let bucket = cashBucketFromCheckoutKey(checkoutKey ?? fromLink);
    if (bucket === "other" && bookingId) bucket = "one_to_one";
    if (bucket === "other" && mode === "subscription") bucket = "community";

    const email =
      readString(summary.email) ||
      readString(raw.customer_email) ||
      readString((raw.customer_details as Record<string, unknown> | undefined)?.email);

    payments.push({
      id: sessionId,
      email: email?.toLowerCase() ?? null,
      name: readString((raw.customer_details as Record<string, unknown> | undefined)?.name),
      amountPence: amount,
      date: event.received_at,
      bucket,
    });
  }

  for (const event of invoices) {
    const raw = event.raw_payload ?? {};
    const reason = readString(raw.billing_reason);
    if (reason === "subscription_create") continue;
    if (reason && reason !== "subscription_cycle" && reason !== "subscription_update") continue;
    const amount = readNumber(raw.amount_paid) ?? 0;
    if (amount <= 0) continue;
    const invoiceId = readString(raw.id) || event.id;
    payments.push({
      id: invoiceId,
      email: readString(raw.customer_email)?.toLowerCase() ?? null,
      name: readString(raw.customer_name),
      amountPence: amount,
      date: event.received_at,
      bucket: "community",
    });
  }

  return payments;
}

function sessionBand(iso: string | null): string | null {
  if (!iso) return null;
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: UK_DISPLAY_TIMEZONE,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso))
  );
  if (Number.isNaN(hour)) return null;
  const weekday = weekdayNameInTimezone(iso, UK_DISPLAY_TIMEZONE);
  const band = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  return `${weekday} ${band}`;
}

function daysUntilStart(startIso: string | null, now: Date): number | null {
  if (!startIso) return null;
  const start = new Date(startIso).getTime();
  if (Number.isNaN(start)) return null;
  return Math.ceil(msToDays(start - now.getTime()));
}

function funnelStage(
  id: FunnelStage["id"],
  name: string,
  count: number | null,
  availability: FunnelStage["availability"],
  previousCount: number | null,
  reason?: string
): FunnelStage {
  return {
    id,
    name,
    availability,
    count: availability === "unavailable" ? null : count,
    conversionFromPrevious:
      id === "leads" ? null : conversionFromPrevious(count, previousCount),
    reason,
  };
}

const NOTION_SOURCE_LABEL = "Notion — leads and sales calls";

async function loadNotionLeads(range: ResolvedAcquisitionRange): Promise<{
  current: number | null;
  previous: number | null;
  source: AcquisitionSourceSync;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const [current, previous] = await Promise.all([
      countNotionLeadsCreated(range.start, range.end, controller.signal),
      countNotionLeadsCreated(range.previousStart, range.previousEnd, controller.signal),
    ]);
    return {
      current,
      previous,
      source: {
        id: "notion",
        label: NOTION_SOURCE_LABEL,
        readAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    const timedOut = controller.signal.aborted;
    const name = error instanceof Error ? error.name : "";
    return {
      current: null,
      previous: null,
      source: {
        id: "notion",
        label: NOTION_SOURCE_LABEL,
        readAt: null,
        error:
          timedOut || name === "TimeoutError" || name === "AbortError"
            ? "Notion request timed out"
            : error instanceof Error
              ? error.message
              : "Failed to read Notion leads",
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

async function loadSalesCallsData(
  supabase: SupabaseClient,
  range: ResolvedAcquisitionRange
): Promise<{
  salesCalls: SalesCallRow[];
  leadById: Map<string, { name: string | null; email: string | null }>;
  error: string | null;
}> {
  const leadById = new Map<string, { name: string | null; email: string | null }>();
  try {
    const salesCalls = await fetchSalesCalls(supabase, range.previousStart.toISOString());
    const leadIds = [
      ...new Set(
        salesCalls
          .map((row) => row.lead_notion_page_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    for (let index = 0; index < leadIds.length; index += 80) {
      const chunk = leadIds.slice(index, index + 80);
      const { data, error } = await supabase
        .from("notion_leads_cache")
        .select("notion_page_id, name, email")
        .in("notion_page_id", chunk);
      if (error) throw new Error(error.message);
      for (const lead of data ?? []) {
        leadById.set(lead.notion_page_id as string, {
          name: (lead.name as string | null) ?? null,
          email: (lead.email as string | null)?.trim().toLowerCase() ?? null,
        });
      }
    }
    return { salesCalls, leadById, error: null };
  } catch (error) {
    return {
      salesCalls: [],
      leadById,
      error: error instanceof Error ? error.message : "Failed to read sales calls",
    };
  }
}

async function loadGhlData(range: ResolvedAcquisitionRange): Promise<{
  opportunityTotal: number | null;
  contacted: number | null;
  cycleDays: number | null;
  source: AcquisitionSourceSync;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const pipelines: GhlPipeline[] = await listGhlSalesPipelines(
      undefined,
      controller.signal
    );
    const stageNameById = new Map<string, string>();
    for (const pipeline of pipelines) {
      for (const stage of pipeline.stages) {
        stageNameById.set(stage.id, stage.name);
      }
    }

    const [createdResults, wonResults] = await Promise.all([
      Promise.all(
        pipelines.map((pipeline) =>
          searchGhlOpportunities({
            pipelineId: pipeline.id,
            status: "all",
            dateStartMs: range.start.getTime(),
            dateEndMs: range.end.getTime(),
            signal: controller.signal,
          })
        )
      ),
      Promise.all(
        pipelines.map((pipeline) =>
          searchGhlOpportunities({
            pipelineId: pipeline.id,
            status: "won",
            dateStartMs: range.start.getTime(),
            dateEndMs: range.end.getTime(),
            signal: controller.signal,
          })
        )
      ),
    ]);

    const ghlOpportunities = createdResults.flatMap((result) => result.opportunities);
    const wonInRange = wonResults
      .flatMap((result) => result.opportunities)
      .filter((opportunity) => inRange(opportunity.lastStatusChangeAt, range.start, range.end));

    return {
      opportunityTotal: createdResults.reduce((sum, result) => sum + result.total, 0),
      contacted: ghlOpportunities.filter((opportunity) => {
        const stageName = stageNameById.get(opportunity.pipelineStageId) ?? "";
        return !isUnworkedPipelineStage(stageName);
      }).length,
      cycleDays: averageCycleDays(
        wonInRange.flatMap((opportunity) => {
          if (!opportunity.createdAt || !opportunity.lastStatusChangeAt) return [];
          const created = new Date(opportunity.createdAt).getTime();
          const closedAt = new Date(opportunity.lastStatusChangeAt).getTime();
          if (!Number.isFinite(created) || !Number.isFinite(closedAt)) return [];
          return [msToDays(closedAt - created)];
        })
      ),
      source: {
        id: "ghl",
        label: "GoHighLevel — pipeline",
        readAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    const aborted = controller.signal.aborted;
    const message =
      aborted || (error instanceof GhlApiError && error.status === 408)
        ? "GHL request timed out"
        : error instanceof GhlApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to read GHL opportunities";
    return {
      opportunityTotal: null,
      contacted: null,
      cycleDays: null,
      source: {
        id: "ghl",
        label: "GoHighLevel — pipeline",
        readAt: null,
        error: message,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

async function loadStripeData(
  supabase: SupabaseClient,
  range: ResolvedAcquisitionRange
): Promise<{
  payments: ClassifiedStripePayment[];
  previousPayments: ClassifiedStripePayment[];
  source: AcquisitionSourceSync;
}> {
  try {
    const [currentEvents, previousEvents] = await Promise.all([
      fetchStripeEvents(supabase, range.start.toISOString(), range.end.toISOString()),
      fetchStripeEvents(
        supabase,
        range.previousStart.toISOString(),
        range.previousEnd.toISOString()
      ),
    ]);
    return {
      payments: classifyStripeEvents(currentEvents),
      previousPayments: classifyStripeEvents(previousEvents),
      source: {
        id: "stripe",
        label: "Stripe — payments",
        readAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      payments: [],
      previousPayments: [],
      source: {
        id: "stripe",
        label: "Stripe — payments",
        readAt: null,
        error: error instanceof Error ? error.message : "Failed to read Stripe webhook events",
      },
    };
  }
}

async function loadCohortData(supabase: SupabaseClient): Promise<{
  upcoming: UpcomingCohortRow[];
  timeToFill: AcquisitionSnapshot["timeToFill"];
  source: AcquisitionSourceSync;
}> {
  try {
    const [{ data: cohorts, error: cohortError }, { data: courses, error: courseError }] =
      await Promise.all([
        supabase
          .from("cohorts")
          .select("id, name, status, capacity, start_date, weekly_session_start, course_id")
          .order("start_date", { ascending: true, nullsFirst: false }),
        supabase.from("courses").select("id, name"),
      ]);
    if (cohortError) throw new Error(cohortError.message);
    if (courseError) throw new Error(courseError.message);
    const courseNameById = new Map(
      (courses ?? []).map((course) => [course.id as string, course.name as string])
    );

    const liveCohorts = (cohorts ?? []).filter(
      (cohort) => !isTestCohortName(cohort.name as string)
    );
    const cohortIds = liveCohorts.map((cohort) => cohort.id as string);
    const membersByCohort = new Map<string, string[]>();
    if (cohortIds.length > 0) {
      const { data: members, error: memberError } = await supabase
        .from("cohort_members")
        .select("cohort_id, joined_at, left_at")
        .in("cohort_id", cohortIds)
        .is("left_at", null);
      if (memberError) throw new Error(memberError.message);
      for (const member of members ?? []) {
        const list = membersByCohort.get(member.cohort_id as string) ?? [];
        if (member.joined_at) list.push(member.joined_at as string);
        membersByCohort.set(member.cohort_id as string, list);
      }
    }

    const now = new Date();
    const upcomingStatuses = new Set(["pre_scheduling", "recruiting", "scheduled"]);
    const upcoming = liveCohorts
      .filter((cohort) => upcomingStatuses.has((cohort.status as string) ?? ""))
      .filter((cohort) => {
        if (!cohort.start_date) return true;
        return new Date(cohort.start_date as string).getTime() >= now.getTime() - 12 * 60 * 60 * 1000;
      })
      .map((cohort) => {
        const filled = membersByCohort.get(cohort.id as string)?.length ?? 0;
        const capacity = (cohort.capacity as number | null) ?? null;
        const daysLeft = daysUntilStart((cohort.start_date as string | null) ?? null, now);
        const fill = cohortFillStatus(capacity == null ? null : filled, capacity, daysLeft);
        const courseName = courseNameById.get(cohort.course_id as string);
        return {
          id: cohort.id as string,
          name: courseName
            ? `${courseName} — ${cohort.name as string}`
            : (cohort.name as string),
          subtitle: sessionBand((cohort.weekly_session_start as string | null) ?? null),
          startsAt: (cohort.start_date as string | null) ?? null,
          filled: capacity == null ? null : filled,
          capacity,
          daysLeft,
          status: fill.status,
          statusLabel: fill.label,
        } satisfies UpcomingCohortRow;
      });

    const timeToFill = liveCohorts
      .map((cohort) => {
        const capacity = (cohort.capacity as number | null) ?? 0;
        const days = timeToFillDays(membersByCohort.get(cohort.id as string) ?? [], capacity);
        if (days == null) return null;
        const start = (cohort.start_date as string | null) ?? null;
        return {
          label: shortCohortLabel((cohort.name as string) ?? "Cohort"),
          days,
          startMs: start ? new Date(start).getTime() : 0,
        };
      })
      .filter((row): row is { label: string; days: number; startMs: number } => row != null)
      .sort((a, b) => b.startMs - a.startMs)
      .slice(0, 6)
      .reverse()
      .map(({ label, days }) => ({ label, days }));

    return {
      upcoming,
      timeToFill,
      source: {
        id: "supabase",
        label: "Supabase — cohorts",
        readAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      upcoming: [],
      timeToFill: [],
      source: {
        id: "supabase",
        label: "Supabase — cohorts",
        readAt: null,
        error: error instanceof Error ? error.message : "Failed to read cohorts",
      },
    };
  }
}

export async function loadAcquisitionSnapshot(
  supabase: SupabaseClient,
  input: {
    rangeId?: AcquisitionRangeId;
    from?: string;
    to?: string;
  } = {}
): Promise<AcquisitionSnapshot> {
  const range: ResolvedAcquisitionRange = resolveAcquisitionRange(
    input.rangeId ?? "30d",
    new Date(),
    input.from && input.to ? { from: input.from, to: input.to } : undefined
  );
  const generatedAt = new Date().toISOString();

  const [notionLeads, salesCallLoad, ghlLoad, stripeLoad, cohortLoad] = await Promise.all([
    loadNotionLeads(range),
    loadSalesCallsData(supabase, range),
    loadGhlData(range),
    loadStripeData(supabase, range),
    loadCohortData(supabase),
  ]);

  const sources: AcquisitionSourceSync[] = [notionLeads.source];
  if (salesCallLoad.error) {
    sources.push({
      id: "supabase",
      label: "Supabase — sales calls",
      readAt: null,
      error: salesCallLoad.error,
    });
  } else if (notionLeads.source.error) {
    sources.push({
      id: "notion",
      label: NOTION_SOURCE_LABEL,
      readAt: new Date().toISOString(),
    });
  }
  sources.push(ghlLoad.source, stripeLoad.source, cohortLoad.source);

  const salesCalls = salesCallLoad.salesCalls;
  const leadById = salesCallLoad.leadById;
  const callsIn = (start: Date, end: Date) =>
    salesCalls.filter((row) => inRange(row.call_date, start, end));
  const currentCalls = callsIn(range.start, range.end);
  const previousCalls = callsIn(range.previousStart, range.previousEnd);
  const bookedCurrent = currentCalls.length;
  const bookedPrevious = previousCalls.length;
  const showedCurrent = currentCalls.filter((row) => row.show_up).length;
  const showedPrevious = previousCalls.filter((row) => row.show_up).length;
  const closedCurrent = currentCalls.filter((row) => row.closed).length;
  const closedPrevious = previousCalls.filter((row) => row.closed).length;

  const notionCashFor = (start: Date, end: Date) => {
    let cashOnCall = 0;
    let paidAfterwards = 0;
    const payments: MatchablePayment[] = [];
    for (const row of salesCalls) {
      const when = row.payment_date || row.call_date;
      if (!inRange(when, start, end)) continue;
      const onCall = poundsToPence(row.cash_on_call);
      const afterwards = poundsToPence(row.paid_afterwards);
      if (onCall <= 0 && afterwards <= 0) continue;
      cashOnCall += onCall;
      paidAfterwards += afterwards;
      const lead = row.lead_notion_page_id ? leadById.get(row.lead_notion_page_id) : null;
      payments.push({
        id: row.id,
        email: lead?.email ?? null,
        name: lead?.name ?? row.notes,
        amountPence: onCall + afterwards,
      });
    }
    return { cashOnCall, paidAfterwards, payments };
  };
  const notionCashCurrent = notionCashFor(range.start, range.end);

  const ghlOpportunityTotal = ghlLoad.opportunityTotal;
  const ghlContacted = ghlLoad.contacted;
  const ghlCycleDays = ghlLoad.cycleDays;

  const stripePayments = stripeLoad.payments;
  const previousStripePayments = stripeLoad.previousPayments;

  const stripeTotalPence = stripePayments.reduce((sum, payment) => sum + payment.amountPence, 0);
  const previousStripeTotalPence = previousStripePayments.reduce(
    (sum, payment) => sum + payment.amountPence,
    0
  );
  const stripeCount = stripePayments.length;
  const previousStripeCount = previousStripePayments.length;
  const avgPackagePence = stripeCount > 0 ? Math.round(stripeTotalPence / stripeCount) : null;
  const previousAvgPackagePence =
    previousStripeCount > 0 ? Math.round(previousStripeTotalPence / previousStripeCount) : null;

  const breakdown: CashBreakdown | null =
    stripeCount === 0
      ? null
      : stripePayments.reduce<CashBreakdown>(
          (acc, payment) => {
            if (payment.bucket === "group") acc.groupPence += payment.amountPence;
            else if (payment.bucket === "one_to_one") acc.oneToOnePence += payment.amountPence;
            else if (payment.bucket === "community") acc.communityPence += payment.amountPence;
            else acc.otherPence += payment.amountPence;
            return acc;
          },
          { groupPence: 0, oneToOnePence: 0, communityPence: 0, otherPence: 0 }
        );

  const stripeSourceFailed = Boolean(stripeLoad.source.error);
  const notionLeadsFailed = notionLeads.current == null;
  const salesCallsFailed = Boolean(salesCallLoad.error);
  const ghlFailed = Boolean(ghlLoad.source.error);
  const upcoming = cohortLoad.upcoming;
  const timeToFill = cohortLoad.timeToFill;

  const newLeads = countMetric(
    notionLeads.current,
    notionLeads.previous,
    notionLeadsFailed ? { unavailableReason: "Could not read Notion leads" } : undefined
  );
  const callsBooked = countMetric(
    salesCallsFailed ? null : bookedCurrent,
    salesCallsFailed ? null : bookedPrevious,
    salesCallsFailed ? { unavailableReason: "Could not read sales calls" } : undefined
  );
  const showRate = rateMetric(
    salesCallsFailed ? null : showedCurrent,
    salesCallsFailed ? null : bookedCurrent,
    showedPrevious,
    bookedPrevious,
    "No calls booked in this period"
  );
  const closeRate = rateMetric(
    salesCallsFailed ? null : closedCurrent,
    salesCallsFailed ? null : showedCurrent,
    closedPrevious,
    showedPrevious,
    "No showed calls in this period"
  );
  const avgPackageValue = moneyMetric(
    stripeSourceFailed ? null : avgPackagePence == null ? 0 : penceToPounds(avgPackagePence),
    previousAvgPackagePence == null ? null : penceToPounds(previousAvgPackagePence),
    stripeSourceFailed
      ? { unavailableReason: "Could not read Stripe payments" }
      : { emptyReason: "No Stripe payments in this period" }
  );

  const opportunities = countMetric(
    ghlFailed ? null : ghlOpportunityTotal,
    null,
    ghlFailed ? { unavailableReason: "Could not read GHL opportunities" } : undefined
  );
  const winRate = rateMetric(
    ghlFailed || salesCallsFailed ? null : closedCurrent,
    ghlFailed ? null : ghlOpportunityTotal,
    null,
    null,
    "No opportunities in this period"
  );
  const cycleDays = countMetric(
    ghlFailed ? null : ghlCycleDays,
    null,
    ghlFailed
      ? { unavailableReason: "Could not read GHL won opportunities" }
      : ghlCycleDays == null
        ? { unavailableReason: "No won opportunities with a cycle length in this period" }
        : undefined
  );

  const velocityValue = salesVelocityPoundsPerDay({
    opportunities: opportunities.availability === "ok" ? opportunities.value : null,
    winRate: winRate.availability === "ok" ? winRate.value : null,
    averageDealValuePounds: avgPackageValue.availability === "ok" ? avgPackageValue.value : null,
    cycleDays: cycleDays.availability === "ok" ? cycleDays.value : null,
  });

  const contactedAvailability: FunnelStage["availability"] = ghlFailed
    ? "unavailable"
    : ghlContacted === 0
      ? "empty"
      : "ok";
  const funnel: FunnelStage[] = [];
  const leadsCount = newLeads.availability === "unavailable" ? null : newLeads.value;
  funnel.push(
    funnelStage("leads", "Leads", leadsCount, newLeads.availability, null, newLeads.reason)
  );
  funnel.push(
    funnelStage(
      "contacted",
      "Contacted",
      ghlFailed ? null : ghlContacted,
      contactedAvailability,
      leadsCount,
      ghlFailed ? "Could not read GHL pipeline" : undefined
    )
  );
  funnel.push(
    funnelStage(
      "booked",
      "Booked",
      salesCallsFailed ? null : bookedCurrent,
      callsBooked.availability,
      ghlFailed ? leadsCount : ghlContacted,
      callsBooked.reason
    )
  );
  funnel.push(
    funnelStage(
      "showed",
      "Showed",
      salesCallsFailed ? null : showedCurrent,
      salesCallsFailed ? "unavailable" : bookedCurrent === 0 ? "empty" : "ok",
      salesCallsFailed ? null : bookedCurrent,
      bookedCurrent === 0 ? "No calls booked in this period" : undefined
    )
  );
  funnel.push(
    funnelStage(
      "closed",
      "Closed",
      salesCallsFailed ? null : closedCurrent,
      salesCallsFailed ? "unavailable" : bookedCurrent === 0 ? "empty" : "ok",
      salesCallsFailed ? null : showedCurrent,
      bookedCurrent === 0 ? "No calls booked in this period" : undefined
    )
  );

  const discrepancy = matchCashDiscrepancy(stripePayments, notionCashCurrent.payments);

  return {
    rangeId: range.id,
    rangeStart: range.start.toISOString(),
    rangeEnd: range.end.toISOString(),
    rangeLabel: range.label,
    generatedAt,
    kpis: {
      newLeads,
      callsBooked,
      showRate,
      closeRate,
      avgPackageValue,
    },
    funnel,
    velocity: {
      availability: velocityValue == null ? "unavailable" : "ok",
      poundsPerDay: velocityValue,
      opportunities,
      winRate,
      avgValue: avgPackageValue,
      cycleDays,
      reason:
        velocityValue == null
          ? "Need opportunities, close rate, average value, and cycle length"
          : undefined,
    },
    upcomingCohorts: upcoming,
    timeToFill,
    cash: {
      stripe: moneyMetric(
        stripeSourceFailed ? null : penceToPounds(stripeTotalPence),
        penceToPounds(previousStripeTotalPence),
        stripeSourceFailed
          ? { unavailableReason: "Could not read Stripe payments" }
          : { emptyReason: "No Stripe payments in this period" }
      ),
      paymentCount: countMetric(
        stripeSourceFailed ? null : stripeCount,
        previousStripeCount,
        stripeSourceFailed ? { unavailableReason: "Could not read Stripe payments" } : undefined
      ),
      avgPayment: avgPackageValue,
      breakdown,
      notion: {
        availability:
          notionCashCurrent.cashOnCall + notionCashCurrent.paidAfterwards === 0
            ? "empty"
            : "ok",
        cashOnCallPence:
          notionCashCurrent.cashOnCall + notionCashCurrent.paidAfterwards === 0
            ? 0
            : notionCashCurrent.cashOnCall,
        paidAfterwardsPence:
          notionCashCurrent.cashOnCall + notionCashCurrent.paidAfterwards === 0
            ? 0
            : notionCashCurrent.paidAfterwards,
        reason:
          notionCashCurrent.cashOnCall + notionCashCurrent.paidAfterwards === 0
            ? "No cash recorded on the sales call log in this period"
            : undefined,
      },
      stripePence: stripeSourceFailed ? null : stripeTotalPence,
      notionPence: notionCashCurrent.cashOnCall + notionCashCurrent.paidAfterwards,
      discrepancy,
    },
    sources,
  };
}
