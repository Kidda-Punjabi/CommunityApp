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
  it("covers adult beginners through Cohort 50 and Kids Circle 1–2", () => {
    const names = buildPublicCohortFallback();
    assert.ok(names.includes("Cohort 45"));
    assert.ok(names.includes("Cohort 46"));
    assert.ok(names.includes(`Cohort ${PUBLIC_ADULT_COHORT_MAX}`));
    assert.ok(names.includes("Kids Circle 1"));
    assert.ok(names.includes("Kids Circle 2"));
  });

  it("canonicalizes lowercase Notion cohort names and keeps later numbers", () => {
    const names = mergePublicSelectOptions(["cohort 23", "Cohort 43"], ["Cohort 46", "Week 8"]);
    assert.ok(names.includes("Cohort 23"));
    assert.equal(names.includes("cohort 23"), false);
    assert.ok(names.includes("Cohort 46"));
    assert.equal(names.includes("Week 8"), false);
  });

  it("keeps adult forms on adult cohorts and kids forms on Kids Circle plus 1-1", () => {
    const all = buildPublicCohortFallback();
    const adult = filterPublicCohortsForAudience(all, "adult");
    const kids = filterPublicCohortsForAudience(all, "kids");

    assert.ok(adult.includes("Cohort 45"));
    assert.ok(adult.includes("Cohort 46"));
    assert.ok(adult.includes(`Cohort ${PUBLIC_ADULT_COHORT_MAX}`));
    assert.ok(adult.includes("1-1"));
    assert.ok(adult.includes("Foundational Course"));
    assert.equal(adult.includes("Kids Circle 1"), false);

    assert.ok(kids.includes("Kids Circle 1"));
    assert.ok(kids.includes("Kids Circle 2"));
    assert.ok(kids.includes("1-1"));
    assert.ok(kids.includes("1-1 Class"));
    assert.equal(kids.includes("Cohort 46"), false);
    assert.equal(kids.includes("Foundational Course"), false);
    assert.equal(publicCohortAudienceFromCourseName("Beginners Course"), "adult");
    assert.equal(publicCohortAudienceFromCourseName("Kids Beginners Course"), "kids");
    assert.equal(
      publicCohortAudienceFromCourseName("Kids Beginners Course (Level 1)"),
      "kids"
    );
  });

  it("labels 1-1 on kids lists instead of Other", () => {
    const groups = groupPublicCohortOptions(["1-1", "1-1 Class", "Kids Circle 1"]);
    assert.deepEqual(
      groups.map((group) => [group.label, group.options]),
      [
        ["1-1", ["1-1", "1-1 Class"]],
        ["Kids Circle", ["Kids Circle 1"]],
      ]
    );
  });
});
