import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classTypeFromEnrollment, classTypeFromFeedback } from "./class-type";
import { consecutiveTrailingFalse, notionWinsTwoWay, ratingMetric } from "./metrics";
import { resolveDeliveryRange } from "./date-range";

describe("classTypeFromFeedback", () => {
  it("maps community, foundational, refresher, 1-1, and beginner group", () => {
    assert.equal(classTypeFromFeedback("Community", "Community"), "community");
    assert.equal(classTypeFromFeedback("Foundational Course", "Cohort 12"), "foundational");
    assert.equal(classTypeFromFeedback("Beginners Course", "Refresher course"), "refresher");
    assert.equal(classTypeFromFeedback("Beginners Course", "1-1 Class"), "one_to_one");
    assert.equal(classTypeFromFeedback("Beginners Course", "Cohort 41"), "beginner_group");
  });
});

describe("classTypeFromEnrollment", () => {
  it("uses delivery mode for beginners and ignores kids/english tracks", () => {
    assert.equal(classTypeFromEnrollment("Beginners Course", "group"), "beginner_group");
    assert.equal(classTypeFromEnrollment("Beginners Course", "one_to_one"), "one_to_one");
    assert.equal(classTypeFromEnrollment("Foundational Course", "one_to_one"), "foundational");
    assert.equal(classTypeFromEnrollment("Kids Beginners Course", "group"), null);
  });
});

describe("consecutiveTrailingFalse", () => {
  it("counts only trailing marked absences", () => {
    assert.equal(consecutiveTrailingFalse([true, false, false]), 2);
    assert.equal(consecutiveTrailingFalse([false, false, true]), 0);
    assert.equal(consecutiveTrailingFalse([false, false, null]), 0);
    assert.equal(consecutiveTrailingFalse([true, false]), 1);
  });
});

describe("notionWinsTwoWay", () => {
  it("lets Notion win when last_edited_time is newer than the dashboard edit", () => {
    assert.equal(
      notionWinsTwoWay("2026-09-12T12:00:00.000Z", "2026-09-12T11:00:00.000Z"),
      true
    );
    assert.equal(
      notionWinsTwoWay("2026-09-12T10:00:00.000Z", "2026-09-12T11:00:00.000Z"),
      false
    );
    assert.equal(notionWinsTwoWay("2026-09-12T12:00:00.000Z", null), true);
    assert.equal(notionWinsTwoWay(null, "2026-09-12T11:00:00.000Z"), false);
  });
});

describe("ratingMetric", () => {
  it("averages current vs prior period", () => {
    const metric = ratingMetric([4, 5], [3, 3]);
    assert.equal(metric.current, 4.5);
    assert.equal(metric.previous, 3);
    assert.equal(metric.delta, 1.5);
    assert.equal(metric.sampleSize, 2);
  });
});

describe("resolveDeliveryRange", () => {
  it("builds a 30-day London window and a matching prior window", () => {
    const range = resolveDeliveryRange("30d", new Date("2026-09-12T12:00:00.000Z"));
    assert.equal(range.label, "Last 30 days");
    assert.ok(range.end.getTime() > range.start.getTime());
    const span = range.end.getTime() - range.start.getTime();
    const priorSpan = range.previousEnd.getTime() - range.previousStart.getTime();
    assert.equal(span, priorSpan);
  });
});
