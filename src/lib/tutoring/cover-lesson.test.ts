import assert from "node:assert/strict";
import test from "node:test";
import {
  coverTaughtByLabel,
  defaultCoverTeacherId,
  lessonCountsAsTaughtBy,
} from "./cover-lesson";

test("cover teacher defaults to the logged-in tutor only when they are not assigned", () => {
  assert.equal(
    defaultCoverTeacherId({ loggedInUserId: "gurupma", assignedTutorId: "kidda" }),
    "gurupma"
  );
  assert.equal(
    defaultCoverTeacherId({ loggedInUserId: "kidda", assignedTutorId: "kidda" }),
    ""
  );
  assert.equal(
    defaultCoverTeacherId({ loggedInUserId: "kidda", assignedTutorId: null }),
    ""
  );
});

test("cover label names the tutor who taught", () => {
  assert.equal(coverTaughtByLabel("Gurupma"), "Cover · taught by Gurupma");
  assert.equal(coverTaughtByLabel("  "), "Cover lesson");
});

test("taught-by counts use the cover teacher, and the assigned class still owns a normal lesson", () => {
  assert.equal(
    lessonCountsAsTaughtBy({
      tutorId: "gurupma",
      classTutorId: "kidda",
      isCoverSession: true,
      actualTutorId: "gurupma",
    }),
    true
  );
  assert.equal(
    lessonCountsAsTaughtBy({
      tutorId: "kidda",
      classTutorId: "kidda",
      isCoverSession: true,
      actualTutorId: "gurupma",
    }),
    false
  );
  assert.equal(
    lessonCountsAsTaughtBy({
      tutorId: "kidda",
      classTutorId: "kidda",
      isCoverSession: false,
      actualTutorId: null,
    }),
    true
  );
});
