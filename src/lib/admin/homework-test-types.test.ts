import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  courseActorFromHomeworkTestStudent,
  filterHomeworkTestStudents,
  homeworkTestLessonLabel,
  homeworkTestStudentKey,
  pickDefaultHomeworkTestCourseId,
  type HomeworkTestCourse,
  type HomeworkTestLesson,
  type HomeworkTestStudent,
} from "./homework-test-types";

const beginners: HomeworkTestCourse = {
  id: "beginners",
  name: "Beginners Course",
  requiredTier: "beginners",
};

function student(
  overrides: Partial<HomeworkTestStudent> = {}
): HomeworkTestStudent {
  return {
    key: "user:a",
    studentId: "a",
    kidProfileId: null,
    displayName: "Amrita",
    email: "amrita@example.com",
    studentPackageId: "pkg-1",
    packageLabel: "Beginners group",
    ...overrides,
  };
}

describe("pickDefaultHomeworkTestCourseId", () => {
  it("defaults to Beginners Course", () => {
    assert.equal(
      pickDefaultHomeworkTestCourseId([
        { id: "foundational", name: "Foundational Course", requiredTier: "foundational" },
        beginners,
        { id: "kids", name: "Kids Beginners Course", requiredTier: "beginners" },
      ]),
      "beginners"
    );
  });
});

describe("filterHomeworkTestStudents", () => {
  const roster = [
    student({ key: "user:a", studentId: "a", displayName: "Amrita Kaur" }),
    student({
      key: "user:b",
      studentId: "b",
      displayName: "Jas",
      email: "jas@kidda.app",
      packageLabel: "Cohort 39",
    }),
  ];

  it("returns everyone when the query is empty", () => {
    assert.equal(filterHomeworkTestStudents(roster, "  ").length, 2);
  });

  it("matches display name, email, or package label", () => {
    assert.equal(filterHomeworkTestStudents(roster, "amrita")[0]?.studentId, "a");
    assert.equal(filterHomeworkTestStudents(roster, "KIDDA")[0]?.studentId, "b");
    assert.equal(filterHomeworkTestStudents(roster, "39")[0]?.studentId, "b");
  });
});

describe("homeworkTestLessonLabel", () => {
  it("includes week, title, and submission type", () => {
    const lesson: HomeworkTestLesson = {
      id: "l2",
      courseId: "beginners",
      lessonNumber: 2,
      title: "Greetings",
      submissionType: "voice",
      activityInstructions: null,
    };
    assert.equal(
      homeworkTestLessonLabel(lesson),
      "Week 2 · Greetings (voice)"
    );
  });
});

describe("courseActorFromHomeworkTestStudent", () => {
  it("builds an adult actor from student_id", () => {
    assert.deepEqual(courseActorFromHomeworkTestStudent(student()), {
      kind: "user",
      userId: "a",
      kidProfileId: null,
    });
  });

  it("builds a kid actor from kid_profile_id", () => {
    const kid = student({
      key: "kid:k1",
      studentId: "parent",
      kidProfileId: "k1",
    });
    assert.equal(homeworkTestStudentKey(kid), "kid:k1");
    assert.deepEqual(courseActorFromHomeworkTestStudent(kid), {
      kind: "kid",
      userId: "parent",
      kidProfileId: "k1",
    });
  });
});
