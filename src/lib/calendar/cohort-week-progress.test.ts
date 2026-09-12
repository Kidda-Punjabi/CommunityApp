import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveCohortCurrentWeek } from "./cohort-week-progress";

describe("deriveCohortCurrentWeek", () => {
  const start = "2026-09-14T12:00:00.000Z";

  it("uses stored week_number on the next upcoming session", () => {
    const week = deriveCohortCurrentWeek({
      startDateIso: start,
      totalWeeks: 12,
      nowMs: Date.parse("2026-09-20T12:00:00.000Z"),
      sessions: [
        { starts_at: "2026-09-21T16:00:00.000Z", week_number: 3, status: "scheduled" },
      ],
    });
    assert.equal(week, 3);
  });

  it("returns week 1 when the cohort has not started", () => {
    const week = deriveCohortCurrentWeek({
      startDateIso: start,
      totalWeeks: 12,
      nowMs: Date.parse("2026-09-12T12:00:00.000Z"),
      sessions: [
        { starts_at: "2026-11-02T16:00:00.000Z", week_number: null, status: "scheduled" },
      ],
    });
    assert.equal(week, 1);
  });

  it("counts elapsed scheduled sessions after start when week_number is missing", () => {
    const week = deriveCohortCurrentWeek({
      startDateIso: "2026-08-16T12:00:00.000Z",
      totalWeeks: 12,
      nowMs: Date.parse("2026-09-12T12:00:00.000Z"),
      sessions: [
        { starts_at: "2026-08-16T16:00:00.000Z", week_number: null, status: "scheduled" },
        { starts_at: "2026-08-23T16:00:00.000Z", week_number: null, status: "scheduled" },
        { starts_at: "2026-08-30T16:00:00.000Z", week_number: null, status: "scheduled" },
        { starts_at: "2026-09-06T16:00:00.000Z", week_number: null, status: "scheduled" },
        { starts_at: "2026-09-13T16:00:00.000Z", week_number: null, status: "scheduled" },
      ],
    });
    assert.equal(week, 4);
  });
});
