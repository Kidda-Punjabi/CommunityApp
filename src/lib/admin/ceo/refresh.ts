import "server-only";

import { loadDeliverySnapshot } from "@/lib/admin/delivery/load-delivery";
import { computeCeoMetrics } from "@/lib/admin/ceo/compute";
import type { CeoCall, CeoCohort, CeoPayment, CeoSnapshot, CeoTarget } from "@/lib/admin/ceo/types";
import { NOTION_LEADS_DATA_SOURCE_ID, notionJson } from "@/lib/notion/client";
import type { SupabaseClient } from "@supabase/supabase-js";

function londonYmd(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function addDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Instant when Europe/London reads this calendar time. */
function londonInstant(ymd: string, time: string): string {
  const utcGuess = new Date(`${ymd}T${time}Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(utcGuess);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const londonAsUtc = Date.UTC(
    Number(value.year),
    Number(value.month) - 1,
    Number(value.day),
    Number(value.hour),
    Number(value.minute),
    Number(value.second)
  );
  return new Date(utcGuess.getTime() - (londonAsUtc - utcGuess.getTime())).toISOString();
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function countNotionLeads(startIso: string, endIso: string): Promise<number> {
  let count = 0;
  let cursor: string | null = null;
  do {
    const body: Record<string, unknown> = {
      page_size: 100,
      filter: {
        and: [
          { timestamp: "created_time", created_time: { on_or_after: startIso } },
          { timestamp: "created_time", created_time: { on_or_before: endIso } },
        ],
      },
    };
    if (cursor) body.start_cursor = cursor;
    const data = await notionJson<{
      results: unknown[];
      has_more: boolean;
      next_cursor: string | null;
    }>(`/databases/${NOTION_LEADS_DATA_SOURCE_ID}/query`, {
      method: "POST",
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    count += data.results.length;
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return count;
}

async function loadTargets(supabase: SupabaseClient): Promise<CeoTarget[]> {
  const { data, error } = await supabase
    .from("ceo_metric_targets")
    .select("metric_id, label, area, format, direction, target, sort_order")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.metric_id as string,
    label: row.label as string,
    area: row.area as CeoTarget["area"],
    format: row.format as CeoTarget["format"],
    direction: row.direction as CeoTarget["direction"],
    target: row.target == null ? null : Number(row.target),
    sortOrder: row.sort_order as number,
  }));
}

async function loadCalls(supabase: SupabaseClient): Promise<CeoCall[]> {
  const pageSize = 1000;
  const rows: CeoCall[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("sales_calls")
      .select("id, lead_notion_page_id, call_date, outcome, show_up, closed")
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    for (const row of batch) {
      rows.push({
        id: row.id as string,
        leadId: (row.lead_notion_page_id as string | null) ?? null,
        callDate: (row.call_date as string | null) ?? null,
        outcome: (row.outcome as string | null) ?? null,
        showUp: Boolean(row.show_up),
        closed: Boolean(row.closed),
      });
    }
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

async function loadStripePayments(
  supabase: SupabaseClient,
  startIso: string,
  endIso: string
): Promise<CeoPayment[]> {
  const pageSize = 1000;
  const rows: CeoPayment[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("stripe_webhook_events")
      .select("id, event_type, received_at, checkout_session_id, payload_summary, raw_payload")
      .in("event_type", ["checkout.session.completed", "invoice.paid"])
      .gte("received_at", startIso)
      .lte("received_at", endIso)
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as Array<Record<string, unknown>>).flatMap(paymentFromStripeEvent));
    if ((data ?? []).length < pageSize) break;
    offset += pageSize;
  }
  const seen = new Set<string>();
  return rows.filter((payment) => {
    if (seen.has(payment.id)) return false;
    seen.add(payment.id);
    return true;
  });
}

function paymentFromStripeEvent(event: Record<string, unknown>): CeoPayment[] {
  const summary = (event.payload_summary as Record<string, unknown> | null) ?? {};
  const raw = (event.raw_payload as Record<string, unknown> | null) ?? {};
  const receivedAt = readString(event.received_at);
  if (event.event_type === "checkout.session.completed") {
    const paymentStatus = readString(summary.payment_status) ?? readString(raw.payment_status);
    const status = readString(summary.status) ?? readString(raw.status);
    if (paymentStatus !== "paid" && status !== "complete") return [];
    const amount = readNumber(summary.amount_total) ?? readNumber(raw.amount_total) ?? 0;
    if (amount <= 0) return [];
    const id =
      readString(event.checkout_session_id) ||
      readString(summary.session_id) ||
      readString(raw.id) ||
      readString(event.id) ||
      "";
    return [
      {
        id,
        amountPence: amount,
        email:
          (
            readString(summary.email) ||
            readString(raw.customer_email) ||
            readString((raw.customer_details as Record<string, unknown> | undefined)?.email)
          )?.toLowerCase() ?? null,
        name: readString((raw.customer_details as Record<string, unknown> | undefined)?.name),
        receivedAt,
      },
    ];
  }
  const reason = readString(raw.billing_reason);
  if (reason === "subscription_create") return [];
  if (reason && reason !== "subscription_cycle" && reason !== "subscription_update") return [];
  const amount = readNumber(raw.amount_paid) ?? 0;
  if (amount <= 0) return [];
  return [
    {
      id: readString(raw.id) || readString(event.id) || "",
      amountPence: amount,
      email: readString(raw.customer_email)?.toLowerCase() ?? null,
      name: readString(raw.customer_name),
      receivedAt,
    },
  ];
}

async function loadNotionPayments(
  supabase: SupabaseClient,
  start: string,
  end: string
): Promise<CeoPayment[]> {
  const { data, error } = await supabase
    .from("sales_calls")
    .select("id, call_date, payment_date, cash_on_call, paid_afterwards, lead_notion_page_id, notes")
    .or(`and(call_date.gte.${start},call_date.lte.${end}),and(payment_date.gte.${start},payment_date.lte.${end})`);
  if (error) throw new Error(error.message);
  const leadIds = [
    ...new Set(
      (data ?? [])
        .map((row) => row.lead_notion_page_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const emails = new Map<string, { email: string | null; name: string | null }>();
  for (let index = 0; index < leadIds.length; index += 200) {
    const slice = leadIds.slice(index, index + 200);
    const { data: leads, error: leadError } = await supabase
      .from("notion_leads_cache")
      .select("notion_page_id, email, name")
      .in("notion_page_id", slice);
    if (leadError) throw new Error(leadError.message);
    for (const lead of leads ?? []) {
      emails.set(lead.notion_page_id as string, {
        email: (lead.email as string | null)?.toLowerCase() ?? null,
        name: (lead.name as string | null) ?? null,
      });
    }
  }
  const payments: CeoPayment[] = [];
  for (const row of data ?? []) {
    const when = (row.payment_date as string | null) || (row.call_date as string | null);
    if (!when || when.slice(0, 10) < start || when.slice(0, 10) > end) continue;
    const amount =
      Math.round((Number(row.cash_on_call) || 0) * 100) + Math.round((Number(row.paid_afterwards) || 0) * 100);
    if (amount <= 0) continue;
    const lead = row.lead_notion_page_id ? emails.get(row.lead_notion_page_id as string) : null;
    payments.push({
      id: row.id as string,
      amountPence: amount,
      email: lead?.email ?? null,
      name: lead?.name ?? (row.notes as string | null),
    });
  }
  return payments;
}

async function loadCohorts(
  supabase: SupabaseClient
): Promise<{ started: CeoCohort[]; recruiting: CeoCohort[] }> {
  const { data, error } = await supabase
    .from("cohorts")
    .select("id, name, start_date, capacity, status, notion_confirmed_count");
  if (error) throw new Error(error.message);
  const { data: members, error: memberError } = await supabase
    .from("cohort_members")
    .select("cohort_id")
    .is("left_at", null);
  if (memberError) throw new Error(memberError.message);
  const memberCount = new Map<string, number>();
  for (const member of members ?? []) {
    const id = member.cohort_id as string;
    memberCount.set(id, (memberCount.get(id) ?? 0) + 1);
  }
  const cohorts = (data ?? []).map((row) => {
    const confirmed =
      row.notion_confirmed_count == null
        ? (memberCount.get(row.id as string) ?? null)
        : Number(row.notion_confirmed_count);
    return {
      id: row.id as string,
      name: (row.name as string | null) ?? "",
      startDate: (row.start_date as string | null) ?? null,
      capacity: row.capacity == null ? null : Number(row.capacity),
      confirmed,
      status: (row.status as string | null) ?? null,
    };
  });
  return { started: cohorts, recruiting: cohorts };
}

async function loadAdSpend(supabase: SupabaseClient, start: string, end: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("meta_ad_spend_daily")
    .select("spend")
    .gte("date", start)
    .lte("date", end);
  if (error) return null;
  if (!data || data.length === 0) return null;
  return data.reduce((sum, row) => sum + Number(row.spend || 0), 0);
}

function isHighQuizScore(score: number): boolean {
  if (score <= 10) return score >= 9;
  return score >= 90;
}

async function loadQuizRate(
  supabase: SupabaseClient,
  startIso: string,
  endIso: string
): Promise<{ rate: number | null; sample: number }> {
  const [{ data: progress, error: progressError }, { data: pub, error: publicError }] = await Promise.all([
    supabase
      .from("quiz_progress")
      .select("score, last_attempted_at")
      .eq("completed", true)
      .gte("last_attempted_at", startIso)
      .lte("last_attempted_at", endIso),
    supabase
      .from("public_quiz_attempts")
      .select("score, submitted_at")
      .gte("submitted_at", startIso)
      .lte("submitted_at", endIso),
  ]);
  if (progressError || publicError) return { rate: null, sample: 0 };
  const scores = [
    ...(progress ?? []).map((row) => Number(row.score)),
    ...(pub ?? []).map((row) => Number(row.score)),
  ].filter((score) => Number.isFinite(score));
  if (scores.length === 0) return { rate: null, sample: 0 };
  const high = scores.filter(isHighQuizScore).length;
  return { rate: high / scores.length, sample: scores.length };
}

export async function refreshCeoMetrics(
  supabase: SupabaseClient,
  now = new Date()
): Promise<CeoSnapshot> {
  const periodEnd = londonYmd(now);
  const periodStart = addDays(periodEnd, -29);
  const startIso = londonInstant(periodStart, "00:00:00");
  const endIso = londonInstant(periodEnd, "23:59:59");

  const targets = await loadTargets(supabase);
  if (targets.length < 24) throw new Error("CEO targets are not seeded.");

  const { data: config, error: configError } = await supabase
    .from("ceo_config")
    .select("vat_registered_from, prices_include_vat")
    .eq("id", "default")
    .maybeSingle();
  if (configError) throw new Error(configError.message);

  const [calls, cohorts, adSpend, quiz] = await Promise.all([
    loadCalls(supabase),
    loadCohorts(supabase),
    loadAdSpend(supabase, periodStart, periodEnd),
    loadQuizRate(supabase, startIso, endIso),
  ]);

  let stripePayments: CeoPayment[] = [];
  let stripeConnected = true;
  try {
    stripePayments = await loadStripePayments(supabase, startIso, endIso);
  } catch {
    stripeConnected = false;
  }

  let notionPayments: CeoPayment[] = [];
  try {
    notionPayments = await loadNotionPayments(supabase, periodStart, periodEnd);
  } catch {
    notionPayments = [];
  }

  let leadsCreated: number | null = null;
  try {
    leadsCreated = await countNotionLeads(startIso, endIso);
  } catch {
    leadsCreated = null;
  }

  let attendanceRate: number | null = null;
  let homeworkRate: number | null = null;
  let tutorEffectiveness: number | null = null;
  let learningRelevance: number | null = null;
  let confidence: number | null = null;
  let feedbackSample = 0;
  let deliveryFollowUps = 0;
  try {
    const delivery = await loadDeliverySnapshot(supabase, {
      tutor: "all",
      rangeId: "custom",
      customFrom: periodStart,
      customTo: periodEnd,
      classType: "all",
    }, now);
    attendanceRate = delivery.attendance.overall == null ? null : delivery.attendance.overall / 100;
    homeworkRate = delivery.homework.overall == null ? null : delivery.homework.overall / 100;
    tutorEffectiveness = delivery.ratings.tutorEffectiveness.current;
    learningRelevance = delivery.ratings.learningRelevance.current;
    confidence = delivery.ratings.confidence.current;
    feedbackSample = delivery.feedbackRowCount;
    deliveryFollowUps =
      delivery.stoppedAttending.length +
      delivery.noScheduledClasses.length +
      delivery.pendingOffboarding.length +
      delivery.toReview.length;
  } catch {
    attendanceRate = null;
  }

  const computed = computeCeoMetrics({
    periodStart,
    periodEnd,
    leadsCreated,
    stripeConnected,
    calls,
    stripePayments,
    notionPayments,
    adSpend,
    cohortsStarted: cohorts.started.filter((cohort) => {
      const day = cohort.startDate?.slice(0, 10);
      return Boolean(day && day >= periodStart && day <= periodEnd);
    }),
    recruitingCohorts: cohorts.recruiting,
    attendanceRate,
    homeworkRate,
    quizHighScoreRate: quiz.rate,
    quizSample: quiz.sample,
    tutorEffectiveness,
    learningRelevance,
    confidence,
    feedbackSample,
    deliveryFollowUps,
    vatRegisteredFrom: String(config?.vat_registered_from ?? "2026-09-01").slice(0, 10),
    pricesIncludeVat: config?.prices_include_vat !== false,
    targets,
  });

  const createdAt = new Date().toISOString();
  const { error: saveError } = await supabase.from("ceo_metric_snapshots").upsert(
    {
      snapshot_date: periodEnd,
      period_start: periodStart,
      period_end: periodEnd,
      metrics: computed.metrics,
      actions: computed.actions,
      created_at: createdAt,
    },
    { onConflict: "snapshot_date" }
  );
  if (saveError) throw new Error(saveError.message);

  return {
    snapshotDate: periodEnd,
    periodStart,
    periodEnd,
    createdAt,
    metrics: computed.metrics,
    actions: computed.actions,
  };
}

export function snapshotFromRow(row: {
  snapshot_date: string;
  period_start: string;
  period_end: string;
  created_at: string;
  metrics: unknown;
  actions: unknown;
}): CeoSnapshot {
  const actions = (row.actions ?? {}) as Partial<CeoSnapshot["actions"]>;
  return {
    snapshotDate: row.snapshot_date,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    createdAt: row.created_at,
    metrics: (row.metrics as CeoSnapshot["metrics"]) ?? [],
    actions: {
      stripeMissing: actions.stripeMissing ?? 0,
      callsNoOutcome: actions.callsNoOutcome ?? 0,
      cohortsNotFull: actions.cohortsNotFull ?? 0,
      deliveryFollowUps: actions.deliveryFollowUps ?? 0,
    },
  };
}
