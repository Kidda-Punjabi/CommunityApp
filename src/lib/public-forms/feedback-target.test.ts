import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WEEK1_STARTING_POINT_LESSON_LABEL } from "../feedback/constants";
import { parsePublicFeedbackTarget, publicFeedbackCopy } from "./feedback-target";

describe("parsePublicFeedbackTarget", () => {
  it("labels week 1 starting point separately from week 1 session, mid-course, and week 12", () => {
    assert.deepEqual(parsePublicFeedbackTarget("week-1-starting-point"), {
      targetId: "week-1-starting-point",
      formVariant: "week1",
      lessonNumber: 1,
      lessonLabel: WEEK1_STARTING_POINT_LESSON_LABEL,
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

  it("parses Kids Beginners L1 week 2 as standard session feedback", () => {
    assert.deepEqual(parsePublicFeedbackTarget("kids-l1-week-2"), {
      targetId: "kids-l1-week-2",
      formVariant: "standard",
      lessonNumber: 2,
      lessonLabel: "Family - Week 2",
      course: "Kids Beginners Course (Level 1)",
    });
  });

  it("does not reuse adult week-2 or foundational-week-2 for kids L1 week 2", () => {
    const kids = parsePublicFeedbackTarget("kids-l1-week-2");
    const adult = parsePublicFeedbackTarget("week-2");
    const foundational = parsePublicFeedbackTarget("foundational-week-2");
    assert.ok(kids && adult && foundational);
    assert.notEqual(kids.course, adult.course);
    assert.notEqual(kids.lessonLabel, adult.lessonLabel);
    assert.notEqual(kids.course, foundational.course);
    assert.deepEqual(adult, {
      targetId: "week-2",
      formVariant: "standard",
      lessonNumber: 2,
      lessonLabel: "Lesson 2",
      course: "Beginners Course",
    });
  });

  it("parses the other Kids Beginners L1 weeks as standard session feedback", () => {
    const weeks: Array<{ week: number; lessonLabel: string }> = [
      { week: 1, lessonLabel: "Greetings & Introductions - Week 1" },
      { week: 3, lessonLabel: "Basic Needs - Week 3" },
      { week: 4, lessonLabel: "Numbers - Week 4" },
      { week: 5, lessonLabel: "Colours - Week 5" },
      { week: 6, lessonLabel: "Food - Week 6" },
      { week: 7, lessonLabel: "Ability - Week 7" },
      { week: 8, lessonLabel: "Hobbies - Week 8" },
      { week: 9, lessonLabel: "Routine - Week 9" },
      { week: 10, lessonLabel: "Imperatives and Position - Week 10" },
      { week: 11, lessonLabel: "Recap - Week 11" },
      { week: 12, lessonLabel: "Conversation - Week 12" },
    ];
    for (const { week, lessonLabel } of weeks) {
      assert.deepEqual(parsePublicFeedbackTarget(`kids-l1-week-${week}`), {
        targetId: `kids-l1-week-${week}`,
        formVariant: "standard",
        lessonNumber: week,
        lessonLabel,
        course: "Kids Beginners Course (Level 1)",
      });
    }
  });

  it("keeps Kids L1 weeks 1 and 12 on the standard form, not adult week1 or week12", () => {
    const week1 = parsePublicFeedbackTarget("kids-l1-week-1");
    const week12 = parsePublicFeedbackTarget("kids-l1-week-12");
    const adultWeek1 = parsePublicFeedbackTarget("week-1-starting-point");
    const adultWeek12 = parsePublicFeedbackTarget("week-12");
    assert.ok(week1 && week12 && adultWeek1 && adultWeek12);
    assert.equal(week1.formVariant, "standard");
    assert.equal(week12.formVariant, "standard");
    assert.equal(adultWeek1.formVariant, "week1");
    assert.equal(adultWeek12.formVariant, "week12");
    assert.equal(publicFeedbackCopy(week1).title, "Greetings & Introductions - Week 1 feedback");
    assert.equal(publicFeedbackCopy(week12).title, "Conversation - Week 12 feedback");
    assert.equal(publicFeedbackCopy(adultWeek12).title, "Week 12 course feedback");
  });

  it("rejects Foundational weeks outside 1–4 and unknown ids", () => {
    assert.equal(parsePublicFeedbackTarget("foundational-week-5"), null);
    assert.equal(parsePublicFeedbackTarget("foundational-week-0"), null);
    assert.equal(parsePublicFeedbackTarget("week-13"), null);
    assert.equal(parsePublicFeedbackTarget("week-1"), null);
    assert.equal(parsePublicFeedbackTarget("kids-l1-week-13"), null);
    assert.equal(parsePublicFeedbackTarget("kids-l1-week-0"), null);
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

  it("does not reuse adult Lesson 2 copy for Kids Beginners L1 week 2", () => {
    const kids = parsePublicFeedbackTarget("kids-l1-week-2");
    const adult = parsePublicFeedbackTarget("week-2");
    assert.ok(kids && adult);
    assert.equal(publicFeedbackCopy(kids).title, "Family - Week 2 feedback");
    assert.match(publicFeedbackCopy(kids).intro, /Kids Beginners Course/);
    assert.equal(publicFeedbackCopy(adult).title, "Lesson 2 feedback");
  });
});
