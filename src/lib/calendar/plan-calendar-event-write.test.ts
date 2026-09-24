import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  planTutorCalendarWrites,
  type CalendarSessionSnapshot,
  type IncomingCalendarEvent,
} from "./plan-calendar-event-write";

function session(overrides: Partial<CalendarSessionSnapshot> & Pick<CalendarSessionSnapshot, "id" | "googleEventId" | "startsAt">): CalendarSessionSnapshot {
  return {
    googleRecurringEventId: "series-1",
    cohortId: "cohort-44",
    studentId: null,
    matchMethod: "calendar_link",
    lessonId: "lesson-3",
    lessonAssignmentStatus: null,
    reschedulingAllowed: false,
    ...overrides,
  };
}

function event(overrides: Partial<IncomingCalendarEvent> & Pick<IncomingCalendarEvent, "id" | "start">): IncomingCalendarEvent {
  return {
    recurringEventId: "series-1",
    matchCohortId: "cohort-44",
    matchStudentId: null,
    ...overrides,
  };
}

describe("planTutorCalendarWrites", () => {
  it("retargets one protected row on the same cohort and UK date instead of inserting", () => {
    const existing = session({
      id: "row-1",
      googleEventId: "old-event",
      startsAt: "2026-09-13T18:00:00.000Z",
    });
    const { plans, cancelledEventIdsToDelete } = planTutorCalendarWrites({
      events: [event({ id: "new-event", start: "2026-09-13T18:30:00.000Z" })],
      sessions: [existing],
      cancelledEventIds: ["old-event"],
    });

    assert.equal(plans.length, 1);
    assert.equal(plans[0]?.action, "update-in-place");
    if (plans[0]?.action !== "update-in-place") return;
    assert.equal(plans[0].sessionId, "row-1");
    assert.equal(plans[0].googleEventId, "new-event");
    assert.equal(plans[0].retargeted, true);
    assert.equal(plans[0].cohortId, "cohort-44");
    assert.deepEqual(cancelledEventIdsToDelete, []);
  });

  it("inserts when no protected same-day row exists", () => {
    const { plans } = planTutorCalendarWrites({
      events: [event({ id: "new-event", start: "2026-09-20T18:00:00.000Z" })],
      sessions: [
        session({
          id: "row-1",
          googleEventId: "old-event",
          startsAt: "2026-09-13T18:00:00.000Z",
        }),
      ],
      cancelledEventIds: [],
    });
    assert.equal(plans[0]?.action, "upsert");
  });

  it("does not retarget when two protected rows share the cohort and date", () => {
    const { plans } = planTutorCalendarWrites({
      events: [event({ id: "new-event", start: "2026-09-13T18:00:00.000Z" })],
      sessions: [
        session({ id: "a", googleEventId: "old-a", startsAt: "2026-09-13T18:00:00.000Z" }),
        session({
          id: "b",
          googleEventId: "old-b",
          startsAt: "2026-09-13T18:05:00.000Z",
          matchMethod: "manual",
        }),
      ],
      cancelledEventIds: [],
    });
    assert.equal(plans[0]?.action, "upsert");
    if (plans[0]?.action !== "upsert") return;
    assert.equal(plans[0].carry, null);
  });

  it("copies lesson_id, match_method, and cohort_id when a same-series same-day row is replaced", () => {
    const { plans } = planTutorCalendarWrites({
      events: [event({ id: "new-event", start: "2026-09-13T18:00:00.000Z" })],
      sessions: [
        session({
          id: "row-1",
          googleEventId: "old-event",
          startsAt: "2026-09-13T18:00:00.000Z",
          matchMethod: "attendee_email",
          lessonId: "lesson-9",
        }),
      ],
      cancelledEventIds: [],
    });
    assert.equal(plans[0]?.action, "upsert");
    if (plans[0]?.action !== "upsert") return;
    assert.deepEqual(plans[0].deleteSessionIds, ["row-1"]);
    assert.equal(plans[0].carry?.lessonId, "lesson-9");
    assert.equal(plans[0].carry?.matchMethod, "attendee_email");
    assert.equal(plans[0].carry?.cohortId, "cohort-44");
  });

  it("copies a cancelled series replacement onto the single new event when the day changed", () => {
    const { plans, cancelledEventIdsToDelete } = planTutorCalendarWrites({
      events: [event({ id: "new-event", start: "2026-09-20T18:00:00.000Z" })],
      sessions: [
        session({
          id: "row-1",
          googleEventId: "old-event",
          startsAt: "2026-09-13T18:00:00.000Z",
          matchMethod: "manual",
          lessonId: "lesson-4",
        }),
      ],
      cancelledEventIds: ["old-event"],
    });
    assert.equal(plans[0]?.action, "upsert");
    if (plans[0]?.action !== "upsert") return;
    assert.equal(plans[0].carry?.lessonId, "lesson-4");
    assert.equal(plans[0].carry?.matchMethod, "manual");
    assert.equal(plans[0].carry?.cohortId, "cohort-44");
    assert.deepEqual(plans[0].deleteSessionIds, ["row-1"]);
    assert.deepEqual(cancelledEventIdsToDelete, []);
  });

  it("does not guess when one cancelled row could belong to two new events", () => {
    const { plans } = planTutorCalendarWrites({
      events: [
        event({ id: "new-a", start: "2026-09-20T18:00:00.000Z" }),
        event({ id: "new-b", start: "2026-09-27T18:00:00.000Z" }),
      ],
      sessions: [
        session({
          id: "row-1",
          googleEventId: "old-event",
          startsAt: "2026-09-13T18:00:00.000Z",
          matchMethod: "manual",
        }),
      ],
      cancelledEventIds: ["old-event"],
    });
    const upserts = plans.filter((plan) => plan.action === "upsert");
    assert.equal(upserts.length, 2);
    assert.ok(upserts.every((plan) => plan.action === "upsert" && plan.carry == null));
  });

  it("updates a protected row with the same event id without treating it as a new insert", () => {
    const { plans } = planTutorCalendarWrites({
      events: [event({ id: "same-event", start: "2026-09-13T19:00:00.000Z" })],
      sessions: [
        session({
          id: "row-1",
          googleEventId: "same-event",
          startsAt: "2026-09-13T18:00:00.000Z",
        }),
      ],
      cancelledEventIds: [],
    });
    assert.equal(plans[0]?.action, "update-in-place");
    if (plans[0]?.action !== "update-in-place") return;
    assert.equal(plans[0].retargeted, false);
    assert.equal(plans[0].sessionId, "row-1");
  });
});
