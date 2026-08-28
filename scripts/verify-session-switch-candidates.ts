/**
 * Session switch candidate matching (same week_number + own-cohort sequence bounds).
 *
 *   node --import tsx scripts/verify-session-switch-candidates.ts
 */
import assert from "node:assert/strict";
import {
  isSessionSwitchCandidate,
  resolveOwnCohortNeighborBounds,
  type SessionSwitchNeighborBounds,
} from "../src/lib/calendar/cohort-switch-candidates";

const source = {
  id: "source",
  course_id: "course-a",
  cohort_id: "cohort-1",
  starts_at: "2026-09-10T18:00:00.000Z",
  week_number: 4,
};

const neighbors: SessionSwitchNeighborBounds = {
  previousStartsAt: "2026-09-03T18:00:00.000Z",
  nextStartsAt: "2026-09-17T18:00:00.000Z",
};

const nowMs = Date.parse("2026-09-01T12:00:00.000Z");

function candidate(
  overrides: Partial<typeof source> & { status?: string; title?: string; week_number?: number | null }
) {
  return {
    id: "other",
    course_id: "course-a",
    cohort_id: "cohort-2",
    status: "scheduled",
    title: "Kidda Class - Cohort 40",
    starts_at: "2026-09-11T18:00:00.000Z",
    week_number: 4,
    ...overrides,
  };
}

function match(
  candidateRow: ReturnType<typeof candidate>,
  bounds: SessionSwitchNeighborBounds = neighbors
) {
  return isSessionSwitchCandidate(source, candidateRow, { nowMs, ...bounds });
}

assert.equal(
  match(candidate({})),
  true,
  "same week_number between previous and next class should match"
);

assert.equal(
  match(candidate({ starts_at: "2026-09-25T18:00:00.000Z" }), {
    previousStartsAt: "2026-09-03T18:00:00.000Z",
    nextStartsAt: null,
  }),
  false,
  "session 15 days later is outside the ±14 day outer cap even with no next_session"
);

assert.equal(
  match(candidate({ starts_at: "2026-09-16T18:00:00.000Z" })),
  true,
  "session 6 days later still matches when it is before the next own class"
);

assert.equal(
  match(candidate({ title: "Kidda Team Meeting" })),
  false,
  "internal meetings must not match even with a real cohort_id"
);

assert.equal(
  match(candidate({ cohort_id: "cohort-1" })),
  false,
  "same cohort is not a candidate"
);

assert.equal(
  match(candidate({ week_number: 5 })),
  false,
  "adjacent week_number must not match even inside the sequence window"
);

assert.equal(
  isSessionSwitchCandidate({ ...source, week_number: null }, candidate({}), { nowMs, ...neighbors }),
  false,
  "source with no week_number cannot prove content equivalence"
);

assert.equal(
  match(candidate({ week_number: null })),
  false,
  "candidate with no week_number cannot prove content equivalence"
);

assert.equal(
  match(candidate({ starts_at: "2026-09-03T18:00:00.000Z" })),
  false,
  "candidate at previous_session.starts_at is not strictly after"
);

assert.equal(
  match(candidate({ starts_at: "2026-09-17T18:00:00.000Z" })),
  false,
  "candidate at next_session.starts_at is not strictly before"
);

assert.equal(
  match(candidate({ starts_at: "2026-09-02T18:00:00.000Z" })),
  false,
  "candidate before previous_session must not match"
);

assert.equal(
  match(candidate({ starts_at: "2026-09-18T18:00:00.000Z" })),
  false,
  "candidate after next_session must not match even within ±14 days"
);

assert.equal(
  match(candidate({ starts_at: "2026-09-24T18:00:00.000Z" }), {
    previousStartsAt: "2026-09-03T18:00:00.000Z",
    nextStartsAt: null,
  }),
  true,
  "session exactly 14 days later is inside the outer cap when there is no next_session"
);

assert.equal(
  match(candidate({ starts_at: "2026-09-16T18:00:00.000Z" }), {
    previousStartsAt: "2026-09-03T18:00:00.000Z",
    nextStartsAt: null,
  }),
  true,
  "missing next_session means no upper sequence bound inside the outer cap"
);

assert.equal(
  match(candidate({ starts_at: "2026-09-01T18:00:00.000Z" }), {
    previousStartsAt: null,
    nextStartsAt: "2026-09-17T18:00:00.000Z",
  }),
  true,
  "missing previous_session means no lower sequence bound inside the outer cap"
);

const amber = {
  id: "f809f2ab-5e44-437f-91d4-a4eb30c99396",
  course_id: "155d5df5-c442-4e95-a908-2a16fa2e8c8d",
  cohort_id: "c9741488-fbec-4a15-bbaf-916f71bdb7c8",
  starts_at: "2026-09-07T18:00:00.000Z",
  week_number: 4,
};
const amberNeighbors = resolveOwnCohortNeighborBounds(amber, [
  {
    id: "4f416e20-20d6-46bf-94c6-98f66d3e1958",
    course_id: amber.course_id,
    cohort_id: amber.cohort_id,
    week_number: 3,
    starts_at: "2026-08-31T18:00:00.000Z",
    title: "Kidda Class - Cohort 41",
  },
  {
    id: "71b8c743-0072-427b-a38e-8daf9917afc8",
    course_id: amber.course_id,
    cohort_id: amber.cohort_id,
    week_number: 5,
    starts_at: "2026-09-14T18:00:00.000Z",
    title: "Kidda Class - Cohort 41",
  },
]);
assert.deepEqual(amberNeighbors, {
  previousStartsAt: "2026-08-31T18:00:00.000Z",
  nextStartsAt: "2026-09-14T18:00:00.000Z",
});

const amberNowMs = Date.parse("2026-08-28T13:00:00.000Z");
assert.equal(
  isSessionSwitchCandidate(
    amber,
    {
      id: "95d94657-8a02-4a7f-add3-58b72258cf3f",
      course_id: amber.course_id,
      cohort_id: "3103fd2c-f359-4503-a4d9-48a3af64327c",
      status: "scheduled",
      title: "Kidda Class - Cohort 42",
      starts_at: "2026-09-17T18:00:00.000Z",
      week_number: 4,
    },
    { nowMs: amberNowMs, ...amberNeighbors }
  ),
  false,
  "Amber Cohort 41 week 4 must not be offered Cohort 42's 17 Sep week 4 (after her own week 5)"
);

console.log("verify-session-switch-candidates: ok");
