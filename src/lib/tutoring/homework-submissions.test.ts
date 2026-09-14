import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { homeworkReviewDisplayName } from "./homework-submissions";

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
