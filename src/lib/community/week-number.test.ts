import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { communityWeekNumber } from "./week-number";

describe("communityWeekNumber", () => {
  it("starts at week 1 in the week of 28 Sep 2026", () => {
    assert.equal(communityWeekNumber(new Date("2026-10-04T09:00:00Z"), "Europe/London"), 1);
  });

  it("puts Sunday 25 Oct 2026 in week 4 (Days of the Week)", () => {
    assert.equal(communityWeekNumber(new Date("2026-10-25T10:00:00Z"), "Europe/London"), 4);
  });

  it("moves to week 5 on Wednesday 28 Oct 2026", () => {
    assert.equal(communityWeekNumber(new Date("2026-10-28T19:00:00Z"), "Europe/London"), 5);
  });

  it("uses the session timezone when the UTC date differs", () => {
    assert.equal(
      communityWeekNumber(new Date("2026-11-11T08:00:00Z"), "Australia/Sydney"),
      7
    );
  });
});
