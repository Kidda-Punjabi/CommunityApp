import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planNotificationInserts } from "./route-notification";

describe("planNotificationInserts", () => {
  it("dual-inserts parent + kid for homework_reviewed on a kid submission", () => {
    assert.deepEqual(
      planNotificationInserts({
        type: "homework_reviewed",
        kidProfileId: "kid-1",
        parentUserId: "parent-1",
      }),
      [
        { user_id: "parent-1", kid_profile_id: null },
        { user_id: null, kid_profile_id: "kid-1" },
      ]
    );
  });

  it("keeps a single adult row for homework_reviewed", () => {
    assert.deepEqual(
      planNotificationInserts({
        type: "homework_reviewed",
        userId: "adult-1",
      }),
      [{ user_id: "adult-1", kid_profile_id: null }]
    );
  });

  it("uses parentUserId, not userId, when both are present for a kid both-type", () => {
    assert.deepEqual(
      planNotificationInserts({
        type: "certificate_issued",
        userId: "should-not-win",
        kidProfileId: "kid-1",
        parentUserId: "parent-1",
      }),
      [
        { user_id: "parent-1", kid_profile_id: null },
        { user_id: null, kid_profile_id: "kid-1" },
      ]
    );
  });

  it("inserts kid-only for cohort_new_student, never the parent", () => {
    assert.deepEqual(
      planNotificationInserts({
        type: "cohort_new_student",
        userId: "parent-1",
        kidProfileId: "kid-1",
        parentUserId: "parent-1",
      }),
      [{ user_id: null, kid_profile_id: "kid-1" }]
    );
  });

  it("keeps adult cohort_new_student as a single user row", () => {
    assert.deepEqual(
      planNotificationInserts({
        type: "cohort_new_student",
        userId: "tutor-1",
      }),
      [{ user_id: "tutor-1", kid_profile_id: null }]
    );
  });

  it("never writes kid_profile_id for parent-only types", () => {
    for (const type of [
      "announcement",
      "student_discount_approved",
      "student_discount_rejected",
      "cohort_placement_pending",
    ] as const) {
      assert.deepEqual(
        planNotificationInserts({
          type,
          userId: "parent-1",
          kidProfileId: "kid-1",
        }),
        [{ user_id: "parent-1", kid_profile_id: null }]
      );
    }
  });

  it("refuses social types against a kid profile", () => {
    assert.deepEqual(
      planNotificationInserts({
        type: "friend_request",
        userId: "parent-1",
        kidProfileId: "kid-1",
      }),
      []
    );
  });

  it("does not invent a both-type row when the parent is unknown", () => {
    assert.deepEqual(
      planNotificationInserts({
        type: "homework_reviewed",
        kidProfileId: "kid-1",
      }),
      []
    );
  });
});
