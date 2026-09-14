import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  kidsCohortsShareAgeGroup,
  normalizeKidsCohortAgeGroup,
} from "./kids-cohort-age-group";

describe("normalizeKidsCohortAgeGroup", () => {
  it("maps live cohort age_group values to class bands", () => {
    assert.equal(normalizeKidsCohortAgeGroup("juniors"), "juniors");
    assert.equal(normalizeKidsCohortAgeGroup("preteens"), "preteens");
    assert.equal(normalizeKidsCohortAgeGroup("teens"), "teens");
    assert.equal(normalizeKidsCohortAgeGroup("kids"), "kids");
  });

  it("does not guess from empty or unknown values", () => {
    assert.equal(normalizeKidsCohortAgeGroup(null), null);
    assert.equal(normalizeKidsCohortAgeGroup("Circle 1 (10-12)"), null);
  });
});

describe("kidsCohortsShareAgeGroup", () => {
  it("lets a 7-9 cohort switch only to another 7-9 cohort", () => {
    assert.equal(kidsCohortsShareAgeGroup("juniors", "juniors"), true);
    assert.equal(kidsCohortsShareAgeGroup("juniors", "preteens"), false);
    assert.equal(kidsCohortsShareAgeGroup("juniors", "teens"), false);
    assert.equal(kidsCohortsShareAgeGroup("juniors", "kids"), false);
  });

  it("rejects a switch when either cohort has no age_group", () => {
    assert.equal(kidsCohortsShareAgeGroup("juniors", null), false);
    assert.equal(kidsCohortsShareAgeGroup(null, "juniors"), false);
  });
});
