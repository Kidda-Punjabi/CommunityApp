import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fullKidGrantMissingNote } from "./full-kid-grant";

describe("fullKidGrantMissingNote", () => {
  it("names every missing part of a kids grant", () => {
    assert.equal(
      fullKidGrantMissingNote(["cohort_members", "student_packages"]),
      "missing: cohort_members, student_packages"
    );
  });
});
