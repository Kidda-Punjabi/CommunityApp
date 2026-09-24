import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectPages,
  cohortIssueBreakdown,
  distinctCohortCount,
  evaluateCohortOpsIssues,
  integrityIssues,
  INTEGRITY_ISSUE_BREAKDOWN,
  isExactKiddaClassTitle,
  setupIssues,
  SETUP_ISSUE_BREAKDOWN,
  type CohortOpsCohort,
  type CohortOpsInput,
  type CohortOpsSession,
} from "./cohort-ops-issues";

const COHORT_37 = "06378eee-6e8b-42d0-a59a-2caa426eddd8";
const COHORT_44 = "1912cdde-680c-4104-98db-70103f75e658";
const COHORT_50 = "4b782420-c0b8-4e3c-8298-dfce8ce839cd";
const TUTOR = "tutor-1";

function cohort(overrides: Partial<CohortOpsCohort> = {}): CohortOpsCohort {
  return {
    id: COHORT_50,
    name: "Cohort 50",
    status: "recruiting",
    tutorId: TUTOR,
    startDate: null,
    ...overrides,
  };
}

function session(overrides: Partial<CohortOpsSession> = {}): CohortOpsSession {
  return {
    id: "session-1",
    cohortId: COHORT_50,
    title: "Kidda Class - Cohort 50",
    startsAt: "2026-10-01T18:00:00.000Z",
    status: "scheduled",
    weekNumber: 1,
    googleRecurringEventId: "rec-1",
    ...overrides,
  };
}

function input(overrides: Partial<CohortOpsInput> = {}): CohortOpsInput {
  const cohorts = overrides.cohorts ?? [cohort()];
  return {
    cohorts,
    cohortNames: cohorts.map((row) => ({ id: row.id, name: row.name })),
    sessions: [],
    activeMemberCountByCohortId: new Map([[COHORT_50, 2]]),
    tutorNameById: new Map([[TUTOR, "Gurupma Singh"]]),
    connectedTutorIds: new Set([TUTOR]),
    ...overrides,
  };
}

describe("exact Kidda Class title", () => {
  it("matches case-insensitively and rejects substrings", () => {
    assert.equal(isExactKiddaClassTitle("KIDDA CLASS - Cohort 50", "Cohort 50"), true);
    assert.equal(isExactKiddaClassTitle("  Kidda Class - Cohort 50  ", "Cohort 50"), true);
    assert.equal(isExactKiddaClassTitle("Kidda Class - Cohort 50 extra", "Cohort 50"), false);
    assert.equal(isExactKiddaClassTitle("EOD Debrief", "Cohort 50"), false);
    assert.equal(isExactKiddaClassTitle("Create Whatsapp GC Cohort 50", "Cohort 50"), false);
  });
});

describe("setup issues", () => {
  it("records every failure, and a meeting series does not count as the class", () => {
    const issues = setupIssues(
      evaluateCohortOpsIssues(
        input({
          sessions: [
            session({
              id: "meeting",
              title: "EOD Debrief",
              googleRecurringEventId: "rec-meeting",
              weekNumber: null,
            }),
          ],
          connectedTutorIds: new Set(),
        })
      )
    );
    assert.deepEqual(
      issues.map((issue) => issue.issueCode),
      ["no_recurring_event", "no_connection"]
    );
    assert.equal(issues[1]?.fixUrl, null);
    assert.match(issues[1]?.fixInstruction ?? "", /Tutor → Calendar/);
    assert.equal(issues[0]?.fixUrl, null);
  });

  it("passes the recurring check only on an exact Kidda Class title with a recurring id", () => {
    const issues = setupIssues(
      evaluateCohortOpsIssues(
        input({
          sessions: [session()],
        })
      )
    );
    assert.equal(issues.length, 0);
  });

  it("skips no-tutor when there are zero members and still records a missing series", () => {
    const issues = setupIssues(
      evaluateCohortOpsIssues(
        input({
          cohorts: [cohort({ tutorId: null, name: "Kidda - Kids Circle 3 (10-12)" })],
          cohortNames: [{ id: COHORT_50, name: "Kidda - Kids Circle 3 (10-12)" }],
          activeMemberCountByCohortId: new Map([[COHORT_50, 0]]),
          sessions: [],
        })
      )
    );
    assert.deepEqual(
      issues.map((issue) => issue.issueCode),
      ["no_recurring_event"]
    );
  });

  it("links a missing tutor to the cohort edit screen when members exist", () => {
    const issues = setupIssues(
      evaluateCohortOpsIssues(
        input({
          cohorts: [cohort({ tutorId: null })],
          activeMemberCountByCohortId: new Map([[COHORT_50, 3]]),
          sessions: [session({ googleRecurringEventId: "rec-1" })],
        })
      )
    );
    assert.equal(issues.length, 1);
    assert.equal(issues[0]?.issueCode, "no_tutor");
    assert.equal(issues[0]?.fixUrl, `/admin/packages/${COHORT_50}`);
  });

  it("excludes test cohorts", () => {
    const issues = evaluateCohortOpsIssues(
      input({
        cohorts: [cohort({ name: "TEST DELETE kids-account-closeout", tutorId: null })],
        activeMemberCountByCohortId: new Map([[COHORT_50, 4]]),
      })
    );
    assert.equal(issues.length, 0);
  });
});

describe("integrity issues", () => {
  it("reports a bank holiday and a week gap on the same cohort", () => {
    const issues = integrityIssues(
      evaluateCohortOpsIssues(
        input({
          cohorts: [cohort({ id: COHORT_37, name: "Cohort 37", status: "in_progress" })],
          cohortNames: [{ id: COHORT_37, name: "Cohort 37" }],
          sessions: [
            session({
              id: "holiday",
              cohortId: COHORT_37,
              title: "Kidda Class - Cohort 37",
              startsAt: "2026-08-31T18:00:00.000Z",
              weekNumber: 8,
            }),
            session({
              id: "week-1",
              cohortId: COHORT_37,
              title: "Kidda Class - Cohort 37",
              startsAt: "2026-07-13T18:00:00.000Z",
              weekNumber: 1,
            }),
            session({
              id: "week-3",
              cohortId: COHORT_37,
              title: "Kidda Class - Cohort 37",
              startsAt: "2026-07-27T18:00:00.000Z",
              weekNumber: 3,
            }),
          ],
        })
      )
    );
    assert.deepEqual(
      issues.map((issue) => issue.issueCode),
      ["bank_holiday", "week_sequence"]
    );
    assert.equal(issues[0]?.sessionId, "holiday");
    assert.match(issues[1]?.issueLabel ?? "", /not continuous from 1/);
    assert.equal(issues[0]?.fixUrl, null);
    assert.equal(issues[1]?.fixUrl, null);
  });

  it("flags a scheduled own class with a null week number", () => {
    const issues = integrityIssues(
      evaluateCohortOpsIssues(
        input({
          cohorts: [cohort({ id: COHORT_37, name: "Cohort 37", status: "in_progress" })],
          cohortNames: [{ id: COHORT_37, name: "Cohort 37" }],
          sessions: [
            session({
              id: "null-week",
              cohortId: COHORT_37,
              title: "Kidda Class - Cohort 37",
              startsAt: "2026-09-21T18:00:00.000Z",
              weekNumber: null,
            }),
          ],
        })
      )
    );
    assert.equal(issues.length, 1);
    assert.equal(issues[0]?.issueCode, "null_week_number");
    assert.equal(issues[0]?.sessionId, "null-week");
  });

  it("flags another cohort's Kidda Class title and a 1-1 title, and ignores meetings", () => {
    const issues = integrityIssues(
      evaluateCohortOpsIssues(
        input({
          cohorts: [
            cohort({ id: COHORT_44, name: "Cohort 44", status: "in_progress" }),
            cohort({ id: COHORT_50, name: "Cohort 50" }),
          ],
          cohortNames: [
            { id: COHORT_44, name: "Cohort 44" },
            { id: COHORT_50, name: "Cohort 50" },
          ],
          sessions: [
            session({
              id: "own",
              cohortId: COHORT_44,
              title: "Kidda Class - Cohort 44",
              weekNumber: 1,
              startsAt: "2026-09-06T18:00:00.000Z",
            }),
            session({
              id: "other",
              cohortId: COHORT_44,
              title: "Kidda Class - Cohort 50",
              weekNumber: null,
              startsAt: "2026-10-01T18:00:00.000Z",
            }),
            session({
              id: "one-to-one",
              cohortId: COHORT_44,
              title: "Yuvraj (Pardip) & Tarn // 1-1 Kidda Classes",
              weekNumber: null,
              startsAt: "2026-06-04T17:00:00.000Z",
            }),
            session({
              id: "meeting",
              cohortId: COHORT_44,
              title: "EOD Debrief",
              weekNumber: null,
              startsAt: "2026-09-01T18:00:00.000Z",
            }),
          ],
          activeMemberCountByCohortId: new Map([
            [COHORT_44, 2],
            [COHORT_50, 2],
          ]),
        })
      )
    );
    const tagged = issues.filter((issue) => issue.issueCode === "mis_tagged");
    assert.deepEqual(
      tagged.map((issue) => issue.sessionId),
      ["one-to-one", "other"]
    );
    assert.match(tagged.find((issue) => issue.sessionId === "other")?.issueLabel ?? "", /Cohort 50/);
    assert.match(tagged.find((issue) => issue.sessionId === "one-to-one")?.issueLabel ?? "", /1-1/);
    assert.equal(
      issues.some((issue) => issue.sessionId === "meeting"),
      false
    );
  });

  it("does not treat a continuous week run as a failure", () => {
    const issues = integrityIssues(
      evaluateCohortOpsIssues(
        input({
          sessions: [
            session({ id: "a", weekNumber: 1, startsAt: "2026-10-01T18:00:00.000Z" }),
            session({ id: "b", weekNumber: 2, startsAt: "2026-10-08T18:00:00.000Z" }),
          ],
        })
      )
    );
    assert.equal(issues.length, 0);
  });
});

describe("card counts", () => {
  it("counts distinct cohorts and breaks down by issue type", () => {
    const issues = evaluateCohortOpsIssues(
      input({
        sessions: [
          session({
            title: "EOD Debrief",
            googleRecurringEventId: "rec-meeting",
          }),
        ],
        connectedTutorIds: new Set(),
      })
    );
    assert.equal(distinctCohortCount(setupIssues(issues)), 1);
    assert.equal(
      cohortIssueBreakdown(setupIssues(issues), SETUP_ISSUE_BREAKDOWN),
      "no Kidda Class series (1), calendar not connected (1)"
    );
    assert.equal(cohortIssueBreakdown(integrityIssues(issues), INTEGRITY_ISSUE_BREAKDOWN), "");
  });
});

describe("collectPages", () => {
  it("reads past a 1000-row page", async () => {
    const rows = await collectPages(async (from, to) => {
      assert.equal(to - from, 999);
      if (from === 0) return Array.from({ length: 1000 }, (_, index) => index);
      if (from === 1000) return [1000];
      return [];
    });
    assert.equal(rows.length, 1001);
    assert.equal(rows[1000], 1000);
  });
});
