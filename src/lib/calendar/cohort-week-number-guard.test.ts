import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cohortWeekNumberWriteError,
  formatWeekSequence,
  inspectCohortWeekNumbers,
  isGuardedCohortClassSession,
} from "./cohort-week-number-guard";

function session(id: string, startsAt: string, weekNumber: number | null) {
  return { id, startsAt, weekNumber };
}

describe("cohort week number guard", () => {
  it("allows a gap and names it", () => {
    const sessions = [
      session("a", "2026-10-01T18:00:00.000Z", 1),
      session("b", "2026-10-08T18:00:00.000Z", 2),
      session("c", "2026-10-15T18:00:00.000Z", 4),
    ];
    assert.equal(cohortWeekNumberWriteError(sessions), null);
    assert.deepEqual(
      inspectCohortWeekNumbers(sessions).gaps.map((gap) => gap.key),
      ["2→4"]
    );
  });

  it("rejects a duplicate week number", () => {
    const error = cohortWeekNumberWriteError([
      session("a", "2026-10-01T18:00:00.000Z", 1),
      session("b", "2026-10-08T18:00:00.000Z", 2),
      session("c", "2026-10-15T18:00:00.000Z", 2),
    ]);
    assert.match(error ?? "", /Week 2 would be used more than once/);
  });

  it("rejects a later session with a lower week number", () => {
    const error = cohortWeekNumberWriteError([
      session("a", "2026-09-21T18:00:00.000Z", 2),
      session("b", "2026-09-28T18:00:00.000Z", 1),
    ]);
    assert.match(error ?? "", /date order/);
    assert.match(error ?? "", /Week 1/);
  });

  it("ignores null weeks when checking order", () => {
    assert.equal(
      cohortWeekNumberWriteError([
        session("a", "2026-09-07T18:00:00.000Z", 2),
        session("b", "2026-09-14T18:00:00.000Z", null),
        session("c", "2026-09-21T18:00:00.000Z", 5),
      ]),
      null
    );
    assert.deepEqual(
      inspectCohortWeekNumbers([
        session("a", "2026-09-07T18:00:00.000Z", 2),
        session("b", "2026-09-14T18:00:00.000Z", null),
        session("c", "2026-09-21T18:00:00.000Z", 5),
      ]).gaps.map((gap) => gap.key),
      ["2→5"]
    );
  });

  it("formats the date=week sequence in UK dates", () => {
    assert.equal(
      formatWeekSequence([
        session("b", "2026-10-08T17:00:00.000Z", 2),
        session("a", "2026-10-01T17:00:00.000Z", 1),
      ]),
      "1 Oct=W1, 8 Oct=W2"
    );
  });

  it("keeps 1-1 titles out of the guard and keeps private-group anchor titles in", () => {
    assert.equal(
      isGuardedCohortClassSession({
        cohort_id: "c",
        title: "Yuvraj & Tarn // 1-1 Kidda Classes",
        status: "scheduled",
        match_method: "manual",
      }),
      false
    );
    const privateTitle = "Harteer, Hartegh and Prabhbir with Navjit // Kidda Punjabi Lessons";
    assert.equal(
      isGuardedCohortClassSession(
        {
          cohort_id: "c",
          title: privateTitle,
          status: "scheduled",
          match_method: "manual",
        },
        new Set([privateTitle])
      ),
      true
    );
  });
});
