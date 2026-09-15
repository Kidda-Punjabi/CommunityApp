import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PUBLIC_ADULT_COHORT_MAX,
  PUBLIC_FEEDBACK_TUTOR_OPTIONS,
  buildPublicCohortFallback,
  filterPublicCohortsForAudience,
  groupPublicCohortOptions,
  isPublicFeedbackTutor,
  mergePublicSelectOptions,
  mergePublicTutorOptions,
  publicCohortAudienceFromCourse,
  publicCohortAudienceFromCourseName,
} from "./options";

describe("public form tutor options", () => {
  it("includes Navjit Kaur on the public tutor list", () => {
    assert.ok(PUBLIC_FEEDBACK_TUTOR_OPTIONS.includes("Navjit Kaur"));
    assert.equal(isPublicFeedbackTutor("Navjit Kaur"), true);
  });

  it("keeps fallback tutors first and appends extra Notion names", () => {
    assert.deepEqual(
      mergePublicTutorOptions(PUBLIC_FEEDBACK_TUTOR_OPTIONS, [
        "Navjit Kaur",
        "Cohort 22",
        "Lorem ipsum dolor",
        "Simran Kaur",
      ]),
      [...PUBLIC_FEEDBACK_TUTOR_OPTIONS, "Simran Kaur"]
    );
  });
});

describe("public form cohort options", () => {
  it("covers beginners through 50, Kids Circles, and Group Foundational 1–10", () => {
    const names = buildPublicCohortFallback();
    assert.ok(names.includes("Cohort 45"));
    assert.ok(names.includes(`Cohort ${PUBLIC_ADULT_COHORT_MAX}`));
    assert.ok(names.includes("Kids Circle 1"));
    assert.ok(names.includes("Group Foundational 1"));
    assert.ok(names.includes("Group Foundational 10"));
    assert.ok(names.includes("1-1"));
    assert.equal(names.includes("1-1 Class"), false);
    assert.equal(names.includes("N/A"), false);
    assert.equal(names.includes("Foundational Course"), false);
  });

  it("merges 1-1 Class into 1-1 and drops N/A", () => {
    const names = mergePublicSelectOptions(["1-1"], ["1-1 Class", "N/A", "Cohort 46"]);
    assert.deepEqual(
      names.filter((name) => name === "1-1" || name === "1-1 Class" || name === "N/A"),
      ["1-1"]
    );
    assert.ok(names.includes("Cohort 46"));
  });

  it("keeps each course type on its own cohort list", () => {
    const all = buildPublicCohortFallback();
    const beginners = filterPublicCohortsForAudience(all, "beginners");
    const foundational = filterPublicCohortsForAudience(all, "foundational");
    const kids = filterPublicCohortsForAudience(all, "kids");

    assert.ok(beginners.includes("Cohort 46"));
    assert.ok(beginners.includes("1-1"));
    assert.ok(beginners.includes("Community"));
    assert.equal(beginners.includes("Kids Circle 1"), false);
    assert.equal(beginners.includes("Group Foundational 1"), false);

    assert.ok(foundational.includes("Group Foundational 1"));
    assert.ok(foundational.includes("Group Foundational 10"));
    assert.ok(foundational.includes("1-1"));
    assert.equal(foundational.includes("Cohort 46"), false);
    assert.equal(foundational.includes("Kids Circle 1"), false);

    assert.ok(kids.includes("Kids Circle 1"));
    assert.ok(kids.includes("Kids Circle 2"));
    assert.ok(kids.includes("1-1"));
    assert.equal(kids.includes("1-1 Class"), false);
    assert.equal(kids.includes("Cohort 46"), false);
    assert.equal(kids.includes("Group Foundational 1"), false);
    assert.equal(kids.includes("Community"), false);

    assert.equal(publicCohortAudienceFromCourseName("Beginners Course"), "beginners");
    assert.equal(publicCohortAudienceFromCourseName("Foundational Course"), "foundational");
    assert.equal(publicCohortAudienceFromCourseName("Kids Beginners Course"), "kids");
    assert.equal(
      publicCohortAudienceFromCourse({
        courseName: "Beginners Course",
        contentTrack: "kids",
      }),
      "kids"
    );
  });

  it("groups 1-1 separately from Kids Circle and Group Foundational", () => {
    const groups = groupPublicCohortOptions([
      "1-1",
      "Cohort 46",
      "Group Foundational 1",
      "Kids Circle 1",
    ]);
    assert.deepEqual(
      groups.map((group) => [group.label, group.options]),
      [
        ["1-1", ["1-1"]],
        ["Beginners cohorts", ["Cohort 46"]],
        ["Group Foundational", ["Group Foundational 1"]],
        ["Kids Circle", ["Kids Circle 1"]],
      ]
    );
  });
});
