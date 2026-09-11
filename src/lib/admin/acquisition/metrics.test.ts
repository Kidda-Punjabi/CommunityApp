import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  averageCycleDays,
  cashBucketFromCheckoutKey,
  cohortFillStatus,
  conversionFromPrevious,
  countMetric,
  isUnworkedPipelineStage,
  matchCashDiscrepancy,
  moneyMetric,
  poundsToPence,
  rateMetric,
  salesVelocityPoundsPerDay,
  shortCohortLabel,
  timeToFillDays,
} from "./metrics";

describe("countMetric", () => {
  it("treats a successful zero as empty, not a KPI reading", () => {
    const metric = countMetric(0, 12);
    assert.equal(metric.availability, "empty");
    assert.equal(metric.value, 0);
  });

  it("keeps a positive count as ok", () => {
    const metric = countMetric(14, 10);
    assert.equal(metric.availability, "ok");
    assert.equal(metric.value, 14);
  });
});

describe("rateMetric", () => {
  it("does not invent a 0% rate when the denominator is empty", () => {
    const metric = rateMetric(0, 0, 0, 0, "No calls booked");
    assert.equal(metric.availability, "unavailable");
    assert.equal(metric.value, null);
  });

  it("keeps a real 0% when people were booked but none showed", () => {
    const metric = rateMetric(0, 10, 4, 10, "No calls booked");
    assert.equal(metric.availability, "ok");
    assert.equal(metric.value, 0);
  });
});

describe("salesVelocityPoundsPerDay", () => {
  it("matches the 6sense formula", () => {
    const value = salesVelocityPoundsPerDay({
      opportunities: 96,
      winRate: 0.34,
      averageDealValuePounds: 612,
      cycleDays: 27,
    });
    assert.ok(value);
    assert.equal(Math.round(value), 740);
  });

  it("returns null when cycle length is missing", () => {
    assert.equal(
      salesVelocityPoundsPerDay({
        opportunities: 96,
        winRate: 0.34,
        averageDealValuePounds: 612,
        cycleDays: null,
      }),
      null
    );
  });
});

describe("pipeline stage helpers", () => {
  it("treats Need to Message as unworked", () => {
    assert.equal(isUnworkedPipelineStage("Need to Message (Pre-Intro)"), true);
    assert.equal(isUnworkedPipelineStage("Need to Call (Pre-Intro)"), false);
    assert.equal(isUnworkedPipelineStage("Intro Call Booked"), false);
    assert.equal(isUnworkedPipelineStage("New Lead"), true);
  });
});

describe("cohortFillStatus", () => {
  it("marks a full cohort", () => {
    assert.equal(cohortFillStatus(8, 8, 12).status, "full");
  });

  it("marks low fill with time left as at risk or behind", () => {
    assert.equal(cohortFillStatus(4, 12, 25).status, "atrisk");
    assert.equal(cohortFillStatus(2, 12, 39).status, "behind");
  });

  it("does not invent a status without capacity", () => {
    assert.equal(cohortFillStatus(3, null, 10).status, "unknown");
  });
});

describe("timeToFillDays", () => {
  it("uses first seat to the seat that filled capacity", () => {
    const days = timeToFillDays(
      ["2026-01-01T00:00:00.000Z", "2026-01-10T00:00:00.000Z", "2026-01-21T00:00:00.000Z"],
      3
    );
    assert.equal(days, 20);
  });

  it("returns null when the cohort never filled", () => {
    assert.equal(timeToFillDays(["2026-01-01T00:00:00.000Z"], 3), null);
  });
});

describe("matchCashDiscrepancy", () => {
  it("flags Stripe payments missing from the sales call log", () => {
    const rows = matchCashDiscrepancy(
      [{ id: "s1", email: "a@kidda.app", name: "A", amountPence: 40000 }],
      []
    );
    assert.equal(rows[0]?.kind, "stripe_only");
  });

  it("flags amount mismatches on the same email", () => {
    const rows = matchCashDiscrepancy(
      [{ id: "s1", email: "a@kidda.app", name: "A", amountPence: 40000 }],
      [{ id: "n1", email: "a@kidda.app", name: "A", amountPence: 25000 }]
    );
    assert.equal(rows[0]?.kind, "amount_mismatch");
    assert.equal(rows[0]?.salesCallId, "n1");
  });

  it("ignores matched amounts within £1", () => {
    const rows = matchCashDiscrepancy(
      [{ id: "s1", email: "a@kidda.app", name: "A", amountPence: 40000 }],
      [{ id: "n1", email: "a@kidda.app", name: "A", amountPence: 40000 }]
    );
    assert.equal(rows.length, 0);
  });
});

describe("other helpers", () => {
  it("maps checkout keys to cash buckets", () => {
    assert.equal(cashBucketFromCheckoutKey("beginners-group"), "group");
    assert.equal(cashBucketFromCheckoutKey("beginners-one-to-one"), "one_to_one");
    assert.equal(cashBucketFromCheckoutKey("community"), "community");
    assert.equal(cashBucketFromCheckoutKey(null), "other");
  });

  it("converts pounds to pence", () => {
    assert.equal(poundsToPence(400), 40000);
  });

  it("computes funnel conversion from the stage above", () => {
    assert.equal(conversionFromPrevious(75, 96), 75 / 96);
    assert.equal(conversionFromPrevious(26, 0), null);
  });

  it("shortens cohort labels", () => {
    assert.equal(shortCohortLabel("Cohort 41"), "C41");
  });

  it("treats missing money as empty rather than a silent £0 KPI when value is 0", () => {
    assert.equal(moneyMetric(0, null).availability, "empty");
  });

  it("averages positive cycle lengths only", () => {
    assert.equal(averageCycleDays([10, 20, 0, -1]), 15);
    assert.equal(averageCycleDays([]), null);
  });
});
