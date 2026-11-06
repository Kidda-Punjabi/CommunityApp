import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  courseInterestTimelineLabel,
  isCourseInterestTimeline,
  isHotCourseInterest,
} from "./course-interest-timeline";

describe("course interest timeline", () => {
  it("accepts only the five options", () => {
    assert.equal(isCourseInterestTimeline("next_2_3_weeks"), true);
    assert.equal(isCourseInterestTimeline("tomorrow"), false);
    assert.equal(isCourseInterestTimeline(null), false);
  });

  it("labels missing answers", () => {
    assert.equal(courseInterestTimelineLabel(null), "Not answered");
    assert.equal(courseInterestTimelineLabel("in_2_3_months"), "In 2 to 3 months");
  });

  it("marks the soonest two as hot", () => {
    assert.equal(isHotCourseInterest("straight_away"), true);
    assert.equal(isHotCourseInterest("next_2_3_weeks"), true);
    assert.equal(isHotCourseInterest("within_a_month"), false);
    assert.equal(isHotCourseInterest(null), false);
  });
});
