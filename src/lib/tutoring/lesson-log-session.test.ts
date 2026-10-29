import assert from "node:assert/strict";
import test from "node:test";
import {
  lessonDateFromNotionStart,
  lessonDateInEventTimeZone,
} from "../calendar/event-timezone";
import { isCompletedLessonLogEntry } from "../lessons/lesson-log-progress";
import {
  collapseClassSessions,
  isClassMatchedSession,
  lessonLogRowCanReceiveSession,
  matchClassSessionGroup,
  planTutorLessonLog,
  type LessonLogSessionCandidate,
} from "./lesson-log-session";

const NOW = new Date("2026-10-22T18:30:00.000Z");

function session(
  overrides: Partial<LessonLogSessionCandidate> & Pick<LessonLogSessionCandidate, "id" | "googleEventId" | "startsAt">
): LessonLogSessionCandidate {
  return {
    eventTimeZone: "Europe/London",
    cohortId: "cohort-44",
    packageInstanceId: null,
    matchMethod: "calendar_link",
    status: "scheduled",
    ...overrides,
  };
}

test("lesson date uses the Google event timezone, then London", () => {
  assert.equal(
    lessonDateInEventTimeZone("2026-08-24T00:30:00.000Z", "America/Vancouver"),
    "2026-08-23"
  );
  assert.equal(
    lessonDateInEventTimeZone("2026-10-22T08:00:00.000Z", "Australia/Sydney"),
    "2026-10-22"
  );
  assert.equal(
    lessonDateInEventTimeZone("2026-10-21T23:30:00.000Z", null),
    "2026-10-22"
  );
  assert.equal(lessonDateFromNotionStart("2026-10-22", "America/Vancouver"), "2026-10-22");
  assert.equal(
    lessonDateFromNotionStart("2026-08-24T00:30:00.000Z", "America/Vancouver"),
    "2026-08-23"
  );
});

test("personal and unmatched events are not class sessions", () => {
  assert.equal(
    isClassMatchedSession({
      cohortId: null,
      packageInstanceId: null,
      matchMethod: "unmatched",
      status: "scheduled",
    }),
    false
  );
  assert.equal(
    isClassMatchedSession({
      cohortId: "cohort-44",
      packageInstanceId: null,
      matchMethod: "title_name",
      status: "scheduled",
    }),
    false
  );
  assert.equal(
    isClassMatchedSession({
      cohortId: "cohort-44",
      packageInstanceId: null,
      matchMethod: "calendar_link",
      status: "cancelled",
    }),
    false
  );
});

test("same class and same start collapse to one log, different starts do not", () => {
  const groups = collapseClassSessions([
    session({ id: "a", googleEventId: "event-b", startsAt: "2026-10-22T18:00:00.000Z" }),
    session({ id: "b", googleEventId: "event-a", startsAt: "2026-10-22T18:00:00Z" }),
    session({
      id: "personal",
      googleEventId: "night",
      startsAt: "2026-10-22T18:00:00.000Z",
      cohortId: null,
      matchMethod: "unmatched",
    }),
    session({ id: "later", googleEventId: "event-c", startsAt: "2026-10-22T19:00:00.000Z" }),
  ]);
  assert.equal(groups.length, 2);
  const collapsed = groups.find((group) => group.length === 2);
  assert.ok(collapsed);
  assert.deepEqual(
    collapsed.map((row) => row.googleEventId),
    ["event-a", "event-b"]
  );
});

test("logging before starts_at is blocked unless an admin supplies a reason", () => {
  const sessions = [
    session({ id: "future", googleEventId: "evt", startsAt: "2026-10-25T18:00:00.000Z" }),
  ];
  const blocked = planTutorLessonLog({
    now: NOW,
    typedDate: "2026-10-25",
    sessions,
    isAdmin: false,
    earlyOverrideReason: "please",
    earlyOverrideBy: "tutor",
  });
  assert.equal(blocked.ok, false);

  const adminWithoutReason = planTutorLessonLog({
    now: NOW,
    typedDate: "2026-10-25",
    sessions,
    isAdmin: true,
    earlyOverrideReason: "  ",
    earlyOverrideBy: "arsh",
  });
  assert.equal(adminWithoutReason.ok, false);

  const allowed = planTutorLessonLog({
    now: NOW,
    typedDate: "2026-10-25",
    sessions,
    isAdmin: true,
    earlyOverrideReason: "Tutor was offline during class",
    earlyOverrideBy: "arsh",
  });
  assert.equal(allowed.ok, true);
  if (!allowed.ok) return;
  assert.equal(allowed.lessonDate, "2026-10-25");
  assert.equal(allowed.needsReview, false);
  assert.equal(allowed.googleEventId, "evt");
  assert.equal(allowed.earlyOverrideBy, "arsh");
  assert.equal(allowed.earlyOverrideReason, "Tutor was offline during class");
});

test("a started class uses the event timezone and does not need review", () => {
  const planned = planTutorLessonLog({
    now: NOW,
    typedDate: "2026-10-22",
    sessions: [
      session({
        id: "sydney",
        googleEventId: "syd",
        startsAt: "2026-10-22T08:00:00.000Z",
        eventTimeZone: "Australia/Sydney",
      }),
    ],
    isAdmin: false,
    earlyOverrideReason: null,
    earlyOverrideBy: null,
  });
  assert.equal(planned.ok, true);
  if (!planned.ok) return;
  assert.equal(planned.lessonDate, "2026-10-22");
  assert.equal(planned.needsReview, false);
  assert.equal(planned.eventTimeZone, "Australia/Sydney");
  assert.equal(planned.earlyOverrideBy, null);
});

test("no matching class event is held for review and keeps the typed date", () => {
  const planned = planTutorLessonLog({
    now: NOW,
    typedDate: "2026-10-22",
    sessions: [
      session({
        id: "other-day",
        googleEventId: "evt",
        startsAt: "2026-10-18T18:00:00.000Z",
      }),
    ],
    isAdmin: false,
    earlyOverrideReason: null,
    earlyOverrideBy: null,
  });
  assert.equal(planned.ok, true);
  if (!planned.ok) return;
  assert.equal(planned.needsReview, true);
  assert.equal(planned.needsReviewReason, "no_calendar_event");
  assert.equal(planned.lessonDate, "2026-10-22");
  assert.equal(planned.googleEventId, null);
});

test("notion can match the UTC date and still store the local pay date", () => {
  const group = matchClassSessionGroup({
    now: NOW,
    typedDate: "2026-08-24",
    alsoMatchUtcDate: true,
    candidates: [
      session({
        id: "van",
        googleEventId: "van",
        startsAt: "2026-08-24T00:30:00.000Z",
        eventTimeZone: "America/Vancouver",
        cohortId: null,
        packageInstanceId: "pkg-1",
        matchMethod: "attendee_email",
      }),
    ],
  });
  assert.ok(group);
  assert.equal(
    lessonDateInEventTimeZone(group[0].startsAt, group[0].eventTimeZone),
    "2026-08-23"
  );
});

test("rows created before the session columns shipped are not backfilled", () => {
  assert.equal(lessonLogRowCanReceiveSession("2026-09-15T21:57:22.657Z"), false);
  assert.equal(lessonLogRowCanReceiveSession("2026-10-22T10:04:59.000Z"), false);
  assert.equal(lessonLogRowCanReceiveSession("2026-10-22T10:11:04.778Z"), true);
  assert.equal(lessonLogRowCanReceiveSession(null), true);
});

test("rows held for review do not count as a completed pay date", () => {
  assert.equal(
    isCompletedLessonLogEntry({
      status: "Completed",
      dismissed_at: null,
      needs_review: true,
    }),
    false
  );
  assert.equal(
    isCompletedLessonLogEntry({
      status: "Completed",
      dismissed_at: null,
      needs_review: false,
    }),
    true
  );
});
