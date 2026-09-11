import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePublicFeedbackTarget, publicFeedbackCopy } from "./feedback-target";

describe("parsePublicFeedbackTarget", () => {
  it("keeps Beginners week 1 starting point, session, mid-course, and week 12 unchanged", () => {
    assert.deepEqual(parsePublicFeedbackTarget("week-1-starting-point"), {
      targetId: "week-1-starting-point",
      formVariant: "week1",
      lessonNumber: 1,
      lessonLabel: "Lesson 1",
      course: "Beginners Course",
    });
    assert.deepEqual(parsePublicFeedbackTarget("week-1-session"), {
      targetId: "week-1-session",
      formVariant: "standard",
      lessonNumber: 1,
      lessonLabel: "Lesson 1",
      course: "Beginners Course",
    });
    assert.deepEqual(parsePublicFeedbackTarget("week-6"), {
      targetId: "week-6",
      formVariant: "standard",
      lessonNumber: 6,
      lessonLabel: "Lesson 6",
      course: "Beginners Course",
    });
    assert.deepEqual(parsePublicFeedbackTarget("week-12"), {
      targetId: "week-12",
      formVariant: "week12",
      lessonNumber: 12,
      lessonLabel: "Lesson 12",
      course: "Beginners Course",
    });
  });

  it("parses Foundational weeks 1–4 as standard session feedback", () => {
    for (const lessonNumber of [1, 2, 3, 4]) {
      assert.deepEqual(parsePublicFeedbackTarget(`foundational-week-${lessonNumber}`), {
        targetId: `foundational-week-${lessonNumber}`,
        formVariant: "standard",
        lessonNumber,
        lessonLabel: `Lesson ${lessonNumber}`,
        course: "Foundational Course",
      });
    }
  });

  it("rejects Foundational weeks outside 1–4 and unknown ids", () => {
    assert.equal(parsePublicFeedbackTarget("foundational-week-5"), null);
    assert.equal(parsePublicFeedbackTarget("foundational-week-0"), null);
    assert.equal(parsePublicFeedbackTarget("week-13"), null);
    assert.equal(parsePublicFeedbackTarget("week-1"), null);
  });
});

describe("publicFeedbackCopy", () => {
  it("does not reuse Beginners starting-point or week 12 copy for Foundational", () => {
    const week1 = parsePublicFeedbackTarget("foundational-week-1");
    const week4 = parsePublicFeedbackTarget("foundational-week-4");
    assert.ok(week1 && week4);
    assert.equal(publicFeedbackCopy(week1).title, "Foundational lesson 1 feedback");
    assert.equal(publicFeedbackCopy(week4).title, "Foundational lesson 4 feedback");
    assert.match(publicFeedbackCopy(week1).intro, /Foundational Course/);
    assert.equal(
      publicFeedbackCopy(parsePublicFeedbackTarget("week-1-starting-point")!).title,
      "Week 1 starting point"
    );
    assert.equal(
      publicFeedbackCopy(parsePublicFeedbackTarget("week-12")!).title,
      "Week 12 course feedback"
    );
  });
});
