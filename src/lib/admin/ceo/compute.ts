import { matchCashDiscrepancy } from "@/lib/admin/acquisition/metrics";
import { isShowedCall, isShowRateEligible } from "@/lib/admin/sales-calls/show-rate";
import { metricStatus } from "@/lib/admin/ceo/status";
import type {
  CeoActions,
  CeoCall,
  CeoCohort,
  CeoInputs,
  CeoMetric,
  CeoPayment,
  CeoTarget,
} from "@/lib/admin/ceo/types";
import { isTestClassName } from "@/lib/tutoring/log-lesson-copy";

const EXCLUDED_BOOKING = new Set(["cancelled", "rescheduled", "rebook", "rebooked"]);

function ymd(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

function inPeriod(value: string | null | undefined, start: string, end: string): boolean {
  const day = ymd(value);
  return Boolean(day && day >= start && day <= end);
}

function personKey(call: CeoCall): string {
  return call.leadId?.trim() || call.id;
}

function outcomeText(outcome: string | null | undefined): string {
  return outcome?.trim().toLowerCase() ?? "";
}

function isRebooked(outcome: string | null | undefined): boolean {
  const value = outcomeText(outcome);
  return value === "rebook" || value === "rebooked";
}

/** Show-rate calls. Cancelled, rescheduled, and rebooked calls are not bookings that happened. */
export function isCeoShowEligible(call: CeoCall): boolean {
  if (isRebooked(call.outcome)) return false;
  return isShowRateEligible(call.outcome, call.showUp);
}

export function isCeoShowed(call: CeoCall): boolean {
  if (!isCeoShowEligible(call)) return false;
  return isShowedCall(call.outcome, call.showUp);
}

function distinct(calls: CeoCall[]): number {
  return new Set(calls.map(personKey)).size;
}

function netPounds(payment: CeoPayment, vatFrom: string, pricesIncludeVat: boolean): number {
  const gross = payment.amountPence / 100;
  const day = ymd(payment.receivedAt);
  if (pricesIncludeVat && day && day >= vatFrom) return gross / 1.2;
  return gross;
}

function isFull(cohort: CeoCohort): boolean {
  if (cohort.capacity == null || cohort.capacity <= 0) return false;
  if (cohort.confirmed == null) return false;
  return cohort.confirmed >= cohort.capacity;
}

function realCohorts(cohorts: CeoCohort[]): CeoCohort[] {
  return cohorts.filter((cohort) => !isTestClassName(cohort.name));
}

function blank(metric: CeoTarget, detail: string): CeoMetric {
  return {
    id: metric.id,
    label: metric.label,
    area: metric.area,
    format: metric.format,
    direction: metric.direction,
    sortOrder: metric.sortOrder,
    value: null,
    numerator: null,
    denominator: null,
    target: metric.target,
    status: "not_connected",
    detail,
  };
}

function filled(
  metric: CeoTarget,
  value: number | null,
  detail: string,
  numerator: number | null = null,
  denominator: number | null = null
): CeoMetric {
  const connected = value != null && Number.isFinite(value);
  return {
    id: metric.id,
    label: metric.label,
    area: metric.area,
    format: metric.format,
    direction: metric.direction,
    sortOrder: metric.sortOrder,
    value: connected ? value : null,
    numerator,
    denominator,
    target: metric.target,
    status: metricStatus(value, metric.target, metric.direction, connected),
    detail,
  };
}

function targetById(targets: CeoTarget[]): Map<string, CeoTarget> {
  return new Map(targets.map((row) => [row.id, row]));
}

function must(targets: Map<string, CeoTarget>, id: string): CeoTarget {
  const row = targets.get(id);
  if (!row) throw new Error(`Missing CEO target ${id}`);
  return row;
}

export function computeCeoMetrics(input: CeoInputs): { metrics: CeoMetric[]; actions: CeoActions } {
  const targets = targetById(input.targets);
  const periodCalls = input.calls.filter((call) => inPeriod(call.callDate, input.periodStart, input.periodEnd));
  const bookedCalls = periodCalls.filter((call) => !EXCLUDED_BOOKING.has(outcomeText(call.outcome)));
  const showedCalls = periodCalls.filter(isCeoShowed);
  const noShowCalls = periodCalls.filter(
    (call) => isCeoShowEligible(call) && !isCeoShowed(call)
  );
  const closedCalls = periodCalls.filter((call) => call.closed && isCeoShowed(call));

  const leads = input.leadsCreated;
  const bookedPeople = distinct(bookedCalls);
  const showedPeople = distinct(showedCalls);
  const noShowPeople = distinct(noShowCalls);
  const deals = distinct(closedCalls);
  const showDenom = showedPeople + noShowPeople;

  const nets = input.stripePayments.map((payment) =>
    netPounds(payment, input.vatRegisteredFrom, input.pricesIncludeVat)
  );
  const cash = nets.reduce((sum, amount) => sum + amount, 0);
  const gross = input.stripePayments.reduce((sum, payment) => sum + payment.amountPence, 0) / 100;
  const aov = input.stripePayments.length > 0 ? cash / input.stripePayments.length : null;

  const stripeOnly = matchCashDiscrepancy(input.stripePayments, input.notionPayments).filter(
    (row) => row.kind === "stripe_only"
  ).length;

  const started = realCohorts(input.cohortsStarted).filter(
    (cohort) => cohort.capacity != null && cohort.capacity > 0 && cohort.confirmed != null
  );
  const full = started.filter(isFull).length;

  const callsNoOutcome = input.calls.filter((call) => {
    const day = ymd(call.callDate);
    if (!day || day >= input.periodEnd) return false;
    return outcomeText(call.outcome) === "";
  }).length;

  const horizon = addDays(input.periodEnd, 14);
  const cohortsNotFull = realCohorts(input.recruitingCohorts).filter((cohort) => {
    const day = ymd(cohort.startDate);
    if (!day || day < input.periodEnd || day > horizon) return false;
    const status = cohort.status?.trim().toLowerCase() ?? "";
    if (status && !status.includes("recruit")) return false;
    return !isFull(cohort);
  }).length;

  const booking =
    leads != null && leads > 0 ? bookedPeople / leads : leads === 0 ? 0 : null;
  const showRate = showDenom > 0 ? showedPeople / showDenom : null;
  const closeRate = showedPeople > 0 ? deals / showedPeople : null;

  const metrics: CeoMetric[] = [
    input.stripeConnected
      ? filled(
          must(targets, "cash_collected"),
          cash,
          input.stripePayments.length === 0
            ? "No paid Stripe checkouts or invoices in this period."
            : `£${gross.toFixed(0)} gross across ${input.stripePayments.length} payments. Net of VAT from ${input.vatRegisteredFrom}.`
        )
      : blank(must(targets, "cash_collected"), "Stripe payments could not be read."),
    filled(
      must(targets, "deals_closed"),
      deals,
      `${deals} leads marked closed on a call they attended.`,
      deals,
      showedPeople
    ),
    input.stripeConnected
      ? filled(
          must(targets, "avg_order_value"),
          aov,
          aov == null
            ? "No Stripe payments in this period. This uses the same paid checkouts and invoices as Avg package value on Acquisition."
            : `Same payments as Avg package value on Acquisition (£${(gross / input.stripePayments.length).toFixed(0)} gross). Shown net of VAT.`
        )
      : blank(
          must(targets, "avg_order_value"),
          "Stripe payments could not be read. Avg package value on Acquisition is the gross average of the same paid checkouts and invoices."
        ),
    filled(
      must(targets, "leads"),
      leads,
      leads == null ? "Notion leads could not be counted." : `${leads} leads created in this period.`,
      leads,
      null
    ),
    filled(
      must(targets, "booking_rate"),
      booking,
      leads == null
        ? "Booking rate needs the lead count."
        : `${bookedPeople} leads booked a call out of ${leads} leads. Cancelled, rescheduled, and rebooked calls are excluded.`,
      bookedPeople,
      leads
    ),
    filled(
      must(targets, "show_rate"),
      showRate,
      showDenom === 0
        ? "No held or no-show calls in this period."
        : `${showedPeople} leads showed and ${noShowPeople} did not. Cancelled, rescheduled, and rebooked calls are excluded.`,
      showedPeople,
      showDenom
    ),
    filled(
      must(targets, "close_rate"),
      closeRate,
      showedPeople === 0
        ? "No leads showed in this period."
        : `${deals} closed out of ${showedPeople} leads who showed.`,
      deals,
      showedPeople
    ),
    blank(
      must(targets, "ltgp_cac"),
      "Gross margin is not connected, so lifetime gross profit per customer cannot be divided by ad spend."
    ),
    blank(
      must(targets, "gross_margin"),
      "Delivery pot and overheads are not synced, so gross margin cannot be calculated."
    ),
    blank(
      must(targets, "net_margin"),
      "Tutor pay and overheads are not synced, so net margin cannot be calculated."
    ),
    blank(must(targets, "overheads_pct"), "Monthly expenses are not synced into the app yet."),
    blank(must(targets, "net_profit"), "Tutor pay and overheads are not synced, so net profit cannot be calculated."),
    filled(
      must(targets, "cohort_fill_rate"),
      started.length > 0 ? full / started.length : null,
      started.length === 0
        ? "No cohorts with a known capacity started in this period."
        : `${full} of ${started.length} cohorts that started in this period are full.`,
      full,
      started.length
    ),
    blank(
      must(targets, "delivery_pot_cover"),
      "Hourly rates are not synced onto packages, so the delivery pot cannot be compared with cohort cash."
    ),
    blank(must(targets, "cash_in_bank"), "Bank balance is not synced into the app yet."),
    blank(
      must(targets, "working_capital_months"),
      "Bank balance and monthly expenses are not synced, so working capital cannot be calculated."
    ),
    filled(
      must(targets, "attendance"),
      input.attendanceRate,
      input.attendanceRate == null
        ? "Attendance is not available for this period."
        : "Same attendance figure as the Delivery tab for this period.",
      null,
      null
    ),
    filled(
      must(targets, "homework_completion"),
      input.homeworkRate,
      input.homeworkRate == null
        ? "Homework completion is not available for this period."
        : "Same homework figure as the Delivery tab for this period.",
      null,
      null
    ),
    filled(
      must(targets, "quiz_score"),
      input.quizSample > 0 ? input.quizHighScoreRate : null,
      input.quizSample > 0
        ? `${input.quizSample} submitted quizzes. A high score is 9 or 10, or 90 or above out of 100.`
        : "No submitted quizzes in this period.",
      null,
      input.quizSample
    ),
    filled(
      must(targets, "tutor_effectiveness"),
      input.tutorEffectiveness,
      input.feedbackSample > 0
        ? `Average of ${input.feedbackSample} feedback rows, the same source as the Delivery tab.`
        : "No feedback rows in this period.",
      null,
      input.feedbackSample
    ),
    filled(
      must(targets, "learning_relevance"),
      input.learningRelevance,
      input.feedbackSample > 0
        ? `Average of ${input.feedbackSample} feedback rows, the same source as the Delivery tab.`
        : "No feedback rows in this period.",
      null,
      input.feedbackSample
    ),
    filled(
      must(targets, "confidence"),
      input.confidence,
      input.feedbackSample > 0
        ? `Average of ${input.feedbackSample} feedback rows, the same source as the Delivery tab.`
        : "No feedback rows in this period.",
      null,
      input.feedbackSample
    ),
    blank(
      must(targets, "course_completion"),
      "Completed presentation is not synced onto packages, so course completion cannot be counted yet."
    ),
    blank(
      must(targets, "continuation_rate"),
      "Next package is not synced onto packages, so continuation cannot be counted yet."
    ),
  ];

  return {
    metrics,
    actions: {
      stripeMissing: stripeOnly,
      callsNoOutcome,
      cohortsNotFull,
      deliveryFollowUps: input.deliveryFollowUps,
    },
  };
}

function addDays(ymdValue: string, days: number): string {
  const [year, month, day] = ymdValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
