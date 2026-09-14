import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildKidsScheduleSessionByLessonId,
  buildScheduleSessionByLessonId,
} from "./lesson-schedule-map";

const COURSE = "kids-course";
const lessons = [
  { id: "week-1", lesson_number: 1 },
  { id: "week-2", lesson_number: 2 },
];

describe("buildKidsScheduleSessionByLessonId", () => {
  it("maps by stored week number like the adult helper", () => {
    const sessions = [
      { course_id: COURSE, lessonNumber: 2, starts_at: "2026-09-21T16:00:00.000Z" },
      { course_id: COURSE, lessonNumber: 1, starts_at: "2026-09-14T16:00:00.000Z" },
    ];
    const adult = buildScheduleSessionByLessonId(sessions, lessons, [COURSE]);
    const kids = buildKidsScheduleSessionByLessonId(sessions, lessons, [COURSE]);
    assert.equal(adult.get("week-1"), sessions[1]);
    assert.equal(kids.get("week-1"), sessions[1]);
    assert.equal(kids.get("week-2"), sessions[0]);
  });

  it("fills weeks chronologically when week numbers are missing", () => {
    const sessions = [
      { course_id: COURSE, lessonNumber: null, starts_at: "2026-09-21T16:00:00.000Z" },
      { course_id: COURSE, lessonNumber: null, starts_at: "2026-09-14T16:00:00.000Z" },
    ];
    const adult = buildScheduleSessionByLessonId(sessions, lessons, [COURSE]);
    const kids = buildKidsScheduleSessionByLessonId(sessions, lessons, [COURSE]);
    assert.equal(adult.size, 0);
    assert.equal(kids.get("week-1"), sessions[1]);
    assert.equal(kids.get("week-2"), sessions[0]);
  });
});
