/**
 * Session switch candidate matching (date window, not week_number).
 *
 *   node --import tsx scripts/verify-session-switch-candidates.ts
 */
import assert from "node:assert/strict";
import { isSessionSwitchCandidate } from "../src/lib/calendar/cohort-switch-candidates";

const source = {
  id: "source",
  course_id: "course-a",
  cohort_id: "cohort-1",
  starts_at: "2026-09-10T18:00:00.000Z",
};

const nowMs = Date.parse("2026-09-01T12:00:00.000Z");

function candidate(overrides: Partial<typeof source> & { status?: string; title?: string }) {
  return {
    id: "other",
    course_id: "course-a",
    cohort_id: "cohort-2",
    status: "scheduled",
    title: "Kidda Class - Cohort 40",
    starts_at: "2026-09-11T18:00:00.000Z",
    ...overrides,
  };
}

assert.equal(
  isSessionSwitchCandidate(source, candidate({}), { nowMs }),
  true,
  "nearby Kidda Class in another cohort should match"
);

assert.equal(
  isSessionSwitchCandidate(
    source,
    candidate({ starts_at: "2026-09-17T18:00:00.000Z" }),
    { nowMs }
  ),
  false,
  "session 7 days later is outside the ±6 day window"
);

assert.equal(
  isSessionSwitchCandidate(
    source,
    candidate({ starts_at: "2026-09-04T18:00:00.000Z" }),
    { nowMs }
  ),
  true,
  "session 6 days earlier still matches"
);

assert.equal(
  isSessionSwitchCandidate(
    source,
    candidate({ title: "Kidda Team Meeting" }),
    { nowMs }
  ),
  false,
  "internal meetings must not match even with a real cohort_id"
);

assert.equal(
  isSessionSwitchCandidate(
    source,
    candidate({ cohort_id: "cohort-1" }),
    { nowMs }
  ),
  false,
  "same cohort is not a candidate"
);

assert.equal(
  isSessionSwitchCandidate(
    { ...source, week_number: 4 } as typeof source,
    candidate({ week_number: 5 } as ReturnType<typeof candidate>),
    { nowMs }
  ),
  true,
  "week_number must not be used as a join key"
);

console.log("verify-session-switch-candidates: ok");
