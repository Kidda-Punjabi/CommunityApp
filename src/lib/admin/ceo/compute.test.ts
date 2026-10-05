import assert from "node:assert/strict";
import test from "node:test";

import { computeCeoMetrics } from "@/lib/admin/ceo/compute";
import { metricStatus } from "@/lib/admin/ceo/status";
import type { CeoInputs, CeoTarget } from "@/lib/admin/ceo/types";

const TARGETS: CeoTarget[] = [
  ["cash_collected", "Cash collected", "acquisition", "currency", "min", 20000, 1],
  ["deals_closed", "Deals closed", "acquisition", "number", "min", 67, 2],
  ["avg_order_value", "Average order value", "acquisition", "currency", "min", 300, 3],
  ["leads", "Leads", "acquisition", "number", "min", 1060, 4],
  ["booking_rate", "Booking rate", "acquisition", "percent", "min", 0.35, 5],
  ["show_rate", "Show rate", "acquisition", "percent", "min", 0.6, 6],
  ["close_rate", "Close rate", "acquisition", "percent", "min", 0.3, 7],
  ["ltgp_cac", "LTGP:CAC", "acquisition", "ratio", "min", 3, 8],
  ["gross_margin", "Gross margin", "operations", "percent", "min", 0.75, 1],
  ["net_margin", "Net margin", "operations", "percent", "min", 0.2, 2],
  ["overheads_pct", "Overheads", "operations", "percent", "max", 0.55, 3],
  ["net_profit", "Net profit", "operations", "currency", "min", null, 4],
  ["cohort_fill_rate", "Cohort fill rate", "operations", "percent", "min", 0.95, 5],
  ["delivery_pot_cover", "Delivery pot cover", "operations", "ratio", "min", 1, 6],
  ["cash_in_bank", "Cash in bank", "operations", "currency", "min", null, 7],
  ["working_capital_months", "Working capital", "operations", "months", "min", 3, 8],
  ["attendance", "Attendance", "delivery", "percent", "min", 0.75, 1],
  ["homework_completion", "Homework completion", "delivery", "percent", "min", 0.5, 2],
  ["quiz_score", "Quiz score", "delivery", "percent", "min", 0.9, 3],
  ["tutor_effectiveness", "Tutor effectiveness", "delivery", "score", "min", 4.8, 4],
  ["learning_relevance", "Learning relevance", "delivery", "score", "min", 4.8, 5],
  ["confidence", "Confidence", "delivery", "score", "min", 4.2, 6],
  ["course_completion", "Course completion", "delivery", "percent", "min", 0.75, 7],
  ["continuation_rate", "Continuation rate", "delivery", "percent", "min", 0.3, 8],
].map(([id, label, area, format, direction, target, sortOrder]) => ({
  id: id as string,
  label: label as string,
  area: area as CeoTarget["area"],
  format: format as CeoTarget["format"],
  direction: direction as CeoTarget["direction"],
  target: target as number | null,
  sortOrder: sortOrder as number,
}));

function baseInput(overrides: Partial<CeoInputs> = {}): CeoInputs {
  return {
    periodStart: "2026-09-06",
    periodEnd: "2026-10-05",
    leadsCreated: 100,
    stripeConnected: true,
    calls: [],
    stripePayments: [],
    notionPayments: [],
    adSpend: null,
    cohortsStarted: [],
    recruitingCohorts: [],
    attendanceRate: null,
    homeworkRate: null,
    quizHighScoreRate: null,
    quizSample: 0,
    tutorEffectiveness: null,
    learningRelevance: null,
    confidence: null,
    feedbackSample: 0,
    deliveryFollowUps: 0,
    vatRegisteredFrom: "2026-09-01",
    pricesIncludeVat: true,
    targets: TARGETS,
    ...overrides,
  };
}

test("show rate ignores cancelled, rescheduled, and rebooked calls", () => {
  const result = computeCeoMetrics(
    baseInput({
      calls: [
        { id: "a", leadId: "l1", callDate: "2026-09-10", outcome: "Closed", showUp: true, closed: true },
        { id: "b", leadId: "l2", callDate: "2026-09-11", outcome: "No Show", showUp: false, closed: false },
        { id: "c", leadId: "l3", callDate: "2026-09-12", outcome: "Cancelled", showUp: false, closed: false },
        { id: "d", leadId: "l4", callDate: "2026-09-13", outcome: "Rescheduled", showUp: false, closed: false },
        { id: "e", leadId: "l5", callDate: "2026-09-14", outcome: "Rebook", showUp: false, closed: false },
        { id: "f", leadId: "l6", callDate: "2026-09-15", outcome: null, showUp: false, closed: false },
      ],
    })
  );
  const show = result.metrics.find((metric) => metric.id === "show_rate");
  assert.equal(show?.numerator, 1);
  assert.equal(show?.denominator, 2);
  assert.equal(show?.value, 0.5);
  assert.equal(result.actions.callsNoOutcome, 1);
});

test("average order value is the Stripe average net of VAT", () => {
  const result = computeCeoMetrics(
    baseInput({
      stripePayments: [
        { id: "s1", amountPence: 12000, email: "a@kidda.app", name: "A", receivedAt: "2026-09-10" },
        { id: "s2", amountPence: 24000, email: "b@kidda.app", name: "B", receivedAt: "2026-09-11" },
      ],
    })
  );
  const aov = result.metrics.find((metric) => metric.id === "avg_order_value");
  const cash = result.metrics.find((metric) => metric.id === "cash_collected");
  assert.equal(aov?.value, 150);
  assert.equal(cash?.value, 300);
  assert.match(aov?.detail ?? "", /Avg package value/);
});

test("cohort fill counts people against capacity and skips test classes", () => {
  const result = computeCeoMetrics(
    baseInput({
      cohortsStarted: [
        { id: "1", name: "Cohort 40", startDate: "2026-09-20", capacity: 8, confirmed: 8, status: "in_progress" },
        { id: "2", name: "Cohort 41", startDate: "2026-09-22", capacity: 8, confirmed: 5, status: "recruiting" },
        { id: "3", name: "TEST cohort", startDate: "2026-09-22", capacity: 8, confirmed: 1, status: "recruiting" },
      ],
      recruitingCohorts: [
        { id: "2", name: "Cohort 41", startDate: "2026-10-10", capacity: 8, confirmed: 5, status: "recruiting" },
      ],
    })
  );
  const fill = result.metrics.find((metric) => metric.id === "cohort_fill_rate");
  assert.equal(fill?.numerator, 1);
  assert.equal(fill?.denominator, 2);
  assert.equal(result.actions.cohortsNotFull, 1);
});

test("status is on target, watch within 10 percent, or needs a target", () => {
  assert.equal(metricStatus(0.35, 0.35, "min", true), "on_target");
  assert.equal(metricStatus(0.32, 0.35, "min", true), "watch");
  assert.equal(metricStatus(0.2, 0.35, "min", true), "off_target");
  assert.equal(metricStatus(0.6, 0.55, "max", true), "watch");
  assert.equal(metricStatus(100, null, "min", true), "needs_target");
  assert.equal(metricStatus(null, 1, "min", false), "not_connected");
});

test("missing bank and expense sources stay not connected", () => {
  const result = computeCeoMetrics(baseInput());
  for (const id of ["cash_in_bank", "overheads_pct", "course_completion", "ltgp_cac"]) {
    assert.equal(result.metrics.find((metric) => metric.id === id)?.status, "not_connected");
  }
});
