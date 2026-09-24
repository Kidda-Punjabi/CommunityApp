import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assignmentForLessonNumber,
  initialLessonSyncMappings,
  sessionWeekNumberIsFrozen,
} from "./lesson-assignment";

describe("assignmentForLessonNumber", () => {
  const lessons = [
    { id: "lesson-1", lessonNumber: 1 },
    { id: "lesson-2", lessonNumber: 2 },
  ];

  it("writes lesson_id and week_number from the matching lessons row", () => {
    assert.deepEqual(assignmentForLessonNumber(2, lessons), {
      lesson_id: "lesson-2",
      week_number: 2,
      lesson_assignment_status: null,
    });
  });

  it("marks a missing lessons row as needs assignment", () => {
    assert.deepEqual(assignmentForLessonNumber(7, lessons), {
      lesson_id: null,
      week_number: null,
      lesson_assignment_status: "needs_assignment",
    });
  });

  it("does not pick a lesson when the number is duplicated", () => {
    assert.equal(
      assignmentForLessonNumber(1, [
        ...lessons,
        { id: "lesson-1b", lessonNumber: 1 },
      ]).lesson_assignment_status,
      "needs_assignment"
    );
  });
});

describe("initialLessonSyncMappings", () => {
  const lessons = [
    { id: "lesson-1", lessonNumber: 1, title: "One" },
    { id: "lesson-2", lessonNumber: 2, title: "Two" },
  ];

  it("pairs untouched sessions to lessons in order and leaves extras unmapped", () => {
    const mappings = initialLessonSyncMappings(lessons, [
      { id: "s1", lessonId: null, needsAssignment: false },
      { id: "s2", lessonId: null, needsAssignment: false },
      { id: "s3", lessonId: null, needsAssignment: false },
    ]);
    assert.deepEqual(mappings, [
      { sessionId: "s1", lessonId: "lesson-1" },
      { sessionId: "s2", lessonId: "lesson-2" },
      { sessionId: "s3", lessonId: null },
    ]);
  });
});

describe("sessionWeekNumberIsFrozen", () => {
  it("skips any row with lesson_id, and calendar_link rows that do not have one yet", () => {
    assert.equal(sessionWeekNumberIsFrozen({ lesson_id: "abc", match_method: "attendee_email" }), true);
    assert.equal(sessionWeekNumberIsFrozen({ lesson_id: null, match_method: "calendar_link" }), true);
    assert.equal(sessionWeekNumberIsFrozen({ lesson_id: null, match_method: "attendee_email" }), false);
  });
});
