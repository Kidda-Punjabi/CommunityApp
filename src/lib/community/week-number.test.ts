import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { communityWeekNumber } from "./week-number";

describe("communityWeekNumber", () => {
  it("starts at week 1 on 15 June 2026", () => {
    assert.equal(communityWeekNumber(new Date("2026-06-21T09:00:00Z"), "Europe/London"), 1);
  });

  it("puts Sunday 18 Oct 2026 in week 18", () => {
    assert.equal(communityWeekNumber(new Date("2026-10-18T09:00:00Z"), "Europe/London"), 18);
  });

  it("uses the session timezone when the UTC date differs", () => {
    assert.equal(
      communityWeekNumber(new Date("2026-11-11T08:00:00Z"), "Australia/Sydney"),
      22
    );
  });
});
