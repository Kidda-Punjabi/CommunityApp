import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveLessonTitleForWeek,
  resolveNextLessonTitle,
} from "./lesson-log-progress";

const LESSONS = [
  { lessonNumber: 1, title: "Greetings" },
  { lessonNumber: 7, title: "Ability" },
];

describe("resolveLessonTitleForWeek", () => {
  it("returns the curriculum title for that week number", () => {
    assert.equal(resolveLessonTitleForWeek(LESSONS, 7), "Ability");
  });

  it("returns null when week or title is missing", () => {
    assert.equal(resolveLessonTitleForWeek(LESSONS, null), null);
    assert.equal(resolveLessonTitleForWeek(LESSONS, 3), null);
    assert.equal(resolveLessonTitleForWeek([{ lessonNumber: 7, title: "  " }], 7), null);
  });
});

describe("resolveNextLessonTitle", () => {
  it("still uses week number, not array index, when lessons are sparse", () => {
    assert.equal(resolveNextLessonTitle(LESSONS, 6), "Ability");
  });
});
