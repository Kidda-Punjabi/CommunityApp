import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildNotionTestScoreProperties,
  cohortSelectFromPackageName,
  studentScoreFromPercent,
  weekSelectFromQuizTitle,
} from "./quiz-notion";
import { pickBestPackageForQuiz } from "./resolve-quiz-student";

describe("studentScoreFromPercent", () => {
  it("converts stored 0–100 percentages back to raw counts for live public quizzes", () => {
    assert.equal(studentScoreFromPercent(80, 10), 8);
    assert.equal(studentScoreFromPercent(64, 10), 6);
    assert.equal(studentScoreFromPercent(85, 20), 17);
    assert.equal(studentScoreFromPercent(67, 12), 8);
    assert.equal(studentScoreFromPercent(100, 10), 10);
  });
});

describe("buildNotionTestScoreProperties", () => {
  it("maps name, email, raw scores, course, and date; omits empty cohort/week/tutor", () => {
    const submittedAt = new Date("2026-09-11T09:26:44.777Z");
    const properties = buildNotionTestScoreProperties({
      fullName: "Kieran Kelly",
      email: "mrkieransingh@gmail.com",
      courseName: "Beginners Course",
      studentScore: 8,
      maxScore: 10,
      submittedAt,
    });

    assert.deepEqual(properties.Name, {
      title: [{ text: { content: "Kieran Kelly" } }],
    });
    assert.deepEqual(properties.Email, {
      rich_text: [{ text: { content: "mrkieransingh@gmail.com" } }],
    });
    assert.deepEqual(properties["Student Score"], { number: 8 });
    assert.deepEqual(properties["Max Score"], { number: 10 });
    assert.deepEqual(properties.Course, { select: { name: "Beginners Course" } });
    assert.deepEqual(properties.Date, { date: { start: submittedAt.toISOString() } });
    assert.equal(properties.Cohort, undefined);
    assert.equal(properties.Week, undefined);
    assert.equal(properties.Tutor, undefined);
  });

  it("includes cohort, week, and tutor only when provided", () => {
    const properties = buildNotionTestScoreProperties({
      fullName: "Guest",
      email: "guest@example.com",
      courseName: "Beginners Course",
      studentScore: 10,
      maxScore: 10,
      submittedAt: new Date("2026-09-11T00:00:00.000Z"),
      cohort: "Public Form",
      week: "Week 8",
      tutor: "Arshdeep Kaur",
    });

    assert.deepEqual(properties.Cohort, { select: { name: "Public Form" } });
    assert.deepEqual(properties.Week, { select: { name: "Week 8" } });
    assert.deepEqual(properties.Tutor, { select: { name: "Arshdeep Kaur" } });
  });
});

describe("weekSelectFromQuizTitle", () => {
  it("maps recap quizzes to Week N and leaves checkpoints blank", () => {
    assert.equal(weekSelectFromQuizTitle("Week 8 Recap Quiz"), "Week 8");
    assert.equal(weekSelectFromQuizTitle("Week 11 Recap Quiz"), "Week 11");
    assert.equal(weekSelectFromQuizTitle("Weeks 8-10 Checkpoint Quiz"), null);
  });
});

describe("cohortSelectFromPackageName", () => {
  it("maps 1-1 package titles and cohort numbers to Test Scores selects", () => {
    assert.equal(
      cohortSelectFromPackageName("Kieran Kelly - 1-1 Beginner Course"),
      "1-1 Class"
    );
    assert.equal(cohortSelectFromPackageName("Kidda - Cohort 42"), "Cohort 42");
  });
});

describe("pickBestPackageForQuiz", () => {
  it("prefers the matching in-progress course over an older package", () => {
    const best = pickBestPackageForQuiz(
      [
        {
          name: "Sunita Casci - 1-1 Foundational Course",
          status: "offboarding_complete",
          course_id: "foundational",
          tutor_id: "tarnjot",
        },
        {
          name: "Sunita Casci - 1-1 Beginner Course",
          status: "classes_completed",
          course_id: "beginners",
          tutor_id: "tarnjot",
        },
      ],
      "beginners"
    );
    assert.equal(best?.name, "Sunita Casci - 1-1 Beginner Course");
  });
});
