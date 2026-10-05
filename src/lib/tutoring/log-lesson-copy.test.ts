import assert from "node:assert/strict";
import test from "node:test";
import {
  compareLessonLogReadback,
  formatLogNotionTitle,
  formatTaughtDate,
  isActiveTeachingClass,
  isFoundationalCourse,
  lessonSlotLabel,
  suggestNextLesson,
} from "./log-lesson-copy";

test("active classes exclude finished, inactive, and test names", () => {
  assert.equal(
    isActiveTeachingClass({ name: "Cohort 40", active: true, status: "in_progress" }),
    true
  );
  assert.equal(
    isActiveTeachingClass({ name: "Cohort 12", active: true, status: "classes_completed" }),
    false
  );
  assert.equal(
    isActiveTeachingClass({ name: "Cohort 9", active: false, status: "in_progress" }),
    false
  );
  assert.equal(
    isActiveTeachingClass({ name: "TEST - Cohort 50", active: true, status: "in_progress" }),
    false
  );
});

test("lesson labels follow the course, not a hardcoded count", () => {
  assert.equal(isFoundationalCourse("Foundational Course"), true);
  assert.equal(isFoundationalCourse("English Foundations (Punjabi-medium)"), false);
  assert.equal(lessonSlotLabel("Foundational Course", 2), "Lesson 2");
  assert.equal(lessonSlotLabel("Beginners Course", 8), "Week 8");
});

test("notion title uses the app suffix and a short date", () => {
  assert.equal(formatTaughtDate("2026-10-05"), "5 Oct");
  assert.equal(
    formatLogNotionTitle({
      name: "Cohort 40",
      courseName: "Beginners Course",
      lessonNumber: 8,
      lessonDate: "2026-10-05",
    }),
    "Cohort 40 - Week 8 - 5 Oct (app)"
  );
  assert.equal(
    formatLogNotionTitle({
      name: "Aman",
      courseName: "Foundational Course",
      lessonNumber: 2,
      lessonDate: "2026-10-05",
    }),
    "Aman - Lesson 2 - 5 Oct (app)"
  );
  assert.equal(formatLogNotionTitle({
    name: "Cohort 40",
    courseName: "Beginners Course",
    lessonNumber: 8,
    lessonDate: "2026-10-05",
  }).includes("—"), false);
});

test("suggested lesson is the lowest number not yet logged", () => {
  const lessons = [
    { lessonId: "a", lessonNumber: 1, title: "One" },
    { lessonId: "b", lessonNumber: 2, title: "Two" },
    { lessonId: "c", lessonNumber: 3, title: "Three" },
  ];
  assert.equal(suggestNextLesson(lessons, ["a"])?.lessonId, "b");
  assert.equal(suggestNextLesson(lessons, ["b"])?.lessonId, "a");
  assert.equal(suggestNextLesson(lessons, ["a", "b", "c"]), null);
});

test("read-back is green only when every field matches", () => {
  const actual = {
    title: "Cohort 40 - Week 8 - 5 Oct (app)",
    date: "2026-10-05",
    lesson: "Week 8",
    recordingUrl: "https://example.com/rec",
    attendeeNames: ["Aman", "Priya"],
    attendeeLeadIds: [],
    absentNames: [],
    tutorName: "Sukh",
    tutorMatched: true,
    notionUrl: "https://notion.so/abc",
  };
  assert.deepEqual(
    compareLessonLogReadback({
      submittedTitle: actual.title,
      submittedDate: actual.date,
      submittedLesson: "Week 8",
      submittedRecordingUrl: actual.recordingUrl,
      submittedPresentNames: ["Priya", "Aman"],
      submittedAbsentNames: ["Raj"],
      actual,
      unmatchedPresentNames: [],
    }),
    []
  );

  const mismatch = compareLessonLogReadback({
    submittedTitle: actual.title,
    submittedDate: actual.date,
    submittedLesson: "Week 8",
    submittedRecordingUrl: actual.recordingUrl,
    submittedPresentNames: ["Aman", "Priya"],
    submittedAbsentNames: ["Raj"],
    actual: { ...actual, attendeeNames: ["Aman"] },
    unmatchedPresentNames: [],
  });
  assert.equal(mismatch.length, 1);
  assert.equal(mismatch[0]?.field, "Attendees");
});
