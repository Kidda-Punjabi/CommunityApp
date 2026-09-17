import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { homeworkReviewDisplayName, homeworkRosterActorKey } from "./homework-submissions";

describe("homeworkReviewDisplayName", () => {
  it("prefers the kid profile name", () => {
    assert.equal(
      homeworkReviewDisplayName({
        kidName: "Simran",
        student: { full_name: "Parent Name", preferred_name: "Parent" },
      }),
      "Simran"
    );
  });

  it("falls back to the adult student display name", () => {
    assert.equal(
      homeworkReviewDisplayName({
        kidName: null,
        student: { full_name: "Amrita Kaur", preferred_name: null },
      }),
      "Amrita"
    );
  });

  it("uses Student when neither name is present", () => {
    assert.equal(homeworkReviewDisplayName({ kidName: "  ", student: null }), "Student");
  });
});

describe("homeworkRosterActorKey", () => {
  it("uses kid_profile_id when present, matching attendance actor keys", () => {
    assert.equal(
      homeworkRosterActorKey({
        student_id: "adult-user",
        kid_profile_id: "kid-profile",
      }),
      "kid-profile"
    );
  });

  it("falls back to student_id for adult submissions", () => {
    assert.equal(
      homeworkRosterActorKey({ student_id: "adult-user", kid_profile_id: null }),
      "adult-user"
    );
  });

  it("returns null when neither foreign key is set", () => {
    assert.equal(homeworkRosterActorKey({ student_id: null, kid_profile_id: null }), null);
  });
});
