import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatNextCohortStartNote, utcToday } from "./next-cohort-start-note";

describe("formatNextCohortStartNote", () => {
  it("formats a cohort start day", () => {
    assert.equal(formatNextCohortStartNote("2026-10-29"), "Next cohort starts: 29 October 2026");
    assert.equal(
      formatNextCohortStartNote("2026-10-29T12:00:00+00:00"),
      "Next cohort starts: 29 October 2026"
    );
  });

  it("returns nothing when the date is missing", () => {
    assert.equal(formatNextCohortStartNote(null), undefined);
    assert.equal(formatNextCohortStartNote("soon"), undefined);
  });
});

describe("utcToday", () => {
  it("uses the UTC calendar day", () => {
    assert.equal(utcToday(new Date("2026-09-25T23:30:00Z")), "2026-09-25");
  });
});
