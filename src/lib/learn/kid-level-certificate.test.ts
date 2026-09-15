import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  certificateStageForCourse,
  cefrForCertificateStage,
  planKidLevelComplete,
} from "./kid-level-certificate";

describe("certificateStageForCourse", () => {
  it("maps the live kids beginners course to beginner", () => {
    assert.equal(
      certificateStageForCourse({
        content_track: "kids",
        required_tier: "private",
        name: "Kids Beginners Course (Level 1)",
      }),
      "beginner"
    );
  });

  it("maps adult beginners by required_tier", () => {
    assert.equal(
      certificateStageForCourse({
        content_track: null,
        required_tier: "beginners",
        name: "Beginners Course",
      }),
      "beginner"
    );
  });
});

describe("cefrForCertificateStage", () => {
  it("uses the Beginner CEFR for kids level certificates", () => {
    assert.equal(cefrForCertificateStage("beginner"), "A2");
  });
});

describe("planKidLevelComplete", () => {
  it("increments 1 to 2 and 2 to 3", () => {
    assert.deepEqual(planKidLevelComplete(1), {
      completedLevel: 1,
      nextLevel: 2,
      incrementLevel: true,
      finishedStageCap: false,
    });
    assert.deepEqual(planKidLevelComplete(2), {
      completedLevel: 2,
      nextLevel: 3,
      incrementLevel: true,
      finishedStageCap: false,
    });
  });

  it("does not increment past level 3", () => {
    assert.deepEqual(planKidLevelComplete(3), {
      completedLevel: 3,
      nextLevel: 3,
      incrementLevel: false,
      finishedStageCap: true,
    });
  });

  it("rejects values outside 1–3", () => {
    assert.equal(planKidLevelComplete(0), null);
    assert.equal(planKidLevelComplete(4), null);
  });
});
