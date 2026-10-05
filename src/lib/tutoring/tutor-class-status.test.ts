import assert from "node:assert/strict";
import test from "node:test";
import { isFinishedTeachingClass } from "./log-lesson-copy";
import { classIssue, classTypePill, lowestLessonNumber, packageNameMatchesStudent } from "./tutor-class-status";

test("finished classes exclude test names", () => {
  assert.equal(
    isFinishedTeachingClass({ name: "Cohort 12", active: false, status: "classes_completed" }),
    true
  );
  assert.equal(
    isFinishedTeachingClass({ name: "TEST 1-1 log sweep", active: false, status: "classes_completed" }),
    false
  );
  assert.equal(
    isFinishedTeachingClass({ name: "Cohort 40", active: true, status: "in_progress" }),
    false
  );
});

test("recording missing wins over homework, and a clean class is up to date", () => {
  assert.deepEqual(
    classIssue({
      courseName: "Beginners Course",
      missingRecordingNumber: 7,
      missingHomeworkNumber: 2,
    }),
    { tone: "red", label: "Week 7 recording missing" }
  );
  assert.deepEqual(
    classIssue({
      courseName: "Foundational Course",
      missingRecordingNumber: null,
      missingHomeworkNumber: 2,
    }),
    { tone: "amber", label: "Lesson 2 homework not submitted" }
  );
  assert.deepEqual(
    classIssue({
      courseName: "Beginners Course",
      missingRecordingNumber: null,
      missingHomeworkNumber: null,
    }),
    { tone: "green", label: "Up to date" }
  );
});

test("pills use the cohort number or the 1-1 course", () => {
  assert.equal(
    classTypePill({ kind: "group", name: "Cohort 7", courseName: "Beginners Course" }),
    "GROUP · 7"
  );
  assert.equal(
    classTypePill({ kind: "one_to_one", name: "Adnan", courseName: "Foundational Course" }),
    "1-1 · FOUNDATIONAL"
  );
  assert.equal(lowestLessonNumber([{ lessonNumber: 4, flagged: false }, { lessonNumber: 2, flagged: true }]), 2);
});

test("a package title can match the student when there is no student_packages row", () => {
  assert.equal(packageNameMatchesStudent("Arsh - Foundational", "Arshdeep Kaur"), true);
  assert.equal(packageNameMatchesStudent("Conor Joss - Foundational Course", "Conor Joss"), true);
  assert.equal(packageNameMatchesStudent("Manisha Bhamra - Beginners Course", "Arshdeep Kaur"), false);
});
