import assert from "node:assert/strict";
import test from "node:test";
import { lessonLogUnlockTargets } from "./lesson-log-unlock-targets";

test("approval unlocks the marked student, and falls back to the package student", () => {
  assert.deepEqual(
    lessonLogUnlockTargets({
      attendance: [{ student_id: "adult", kid_profile_id: null }],
      packageStudentIds: ["someone-else"],
    }),
    [{ studentId: "adult", kidProfileId: null }]
  );
  assert.deepEqual(
    lessonLogUnlockTargets({
      attendance: [{ student_id: null, kid_profile_id: "kid" }],
      packageStudentIds: [],
    }),
    [{ studentId: null, kidProfileId: "kid" }]
  );
  assert.deepEqual(
    lessonLogUnlockTargets({
      attendance: [],
      packageStudentIds: ["parent"],
    }),
    [{ studentId: "parent", kidProfileId: null }]
  );
});
