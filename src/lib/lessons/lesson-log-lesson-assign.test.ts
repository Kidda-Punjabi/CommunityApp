import assert from "node:assert/strict";
import test from "node:test";
import { assignMissingLessonIds } from "./lesson-log-lesson-assign";

test("a saved lesson id is not replaced by log order", () => {
  const lessonIdByNumber = new Map([
    [1, "lesson-1"],
    [2, "lesson-2"],
    [3, "lesson-3"],
  ]);
  const updates = assignMissingLessonIds(
    [
      { lessonId: "lesson-2" },
      { lessonId: "lesson-1" },
      { lessonId: null },
    ],
    lessonIdByNumber
  );
  assert.deepEqual(updates, [{ index: 2, lessonId: "lesson-3" }]);
});
