import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatKidsNextLessonWarning,
  homeworkTimingStateFromStartsAt,
  isKidsHomeworkClassSession,
} from "./homework-timing";

const KIDS_COURSE = "9db3685b-15fe-41a3-b902-1c2db3000b33";

describe("homeworkTimingStateFromStartsAt", () => {
  const now = new Date("2026-09-14T21:00:00.000Z");

  it("is on time when the next lesson is more than 24 hours away", () => {
    assert.equal(
      homeworkTimingStateFromStartsAt("2026-09-21T16:00:00.000Z", now),
      "on_time"
    );
  });

  it("is late when the next lesson is within 24 hours and has not started", () => {
    assert.equal(
      homeworkTimingStateFromStartsAt("2026-09-15T16:00:00.000Z", now),
      "late"
    );
  });

  it("is post_lesson once the next lesson has started", () => {
    assert.equal(
      homeworkTimingStateFromStartsAt("2026-09-14T16:00:00.000Z", now),
      "post_lesson"
    );
  });

  it("is unknown when there is no next lesson", () => {
    assert.equal(homeworkTimingStateFromStartsAt(null, now), "unknown");
  });
});

describe("isKidsHomeworkClassSession", () => {
  it("keeps Circle class rows and drops mis-tagged Kidda Class title_name rows", () => {
    assert.equal(
      isKidsHomeworkClassSession({
        title: "Kidda - Circle 1 (10-12)",
        match_method: "manual",
        course_id: KIDS_COURSE,
        kidsCourseId: KIDS_COURSE,
      }),
      true
    );
    assert.equal(
      isKidsHomeworkClassSession({
        title: "Kidda Class - Cohort 51",
        match_method: "title_name",
        course_id: KIDS_COURSE,
        kidsCourseId: KIDS_COURSE,
      }),
      false
    );
  });
});

describe("formatKidsNextLessonWarning", () => {
  it("names the next UK lesson date and time", () => {
    const message = formatKidsNextLessonWarning("2026-09-21T16:00:00.000Z");
    assert.match(message, /Monday 21 September/);
    assert.match(message, /17:00/);
    assert.match(message, /Submit before then to guarantee it's reviewed/);
  });
});
