import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatTimeOpen } from "./format-time-open";

describe("formatTimeOpen", () => {
  const now = new Date("2026-09-12T14:00:00.000Z");

  it("formats sub-hour and same-day values", () => {
    assert.equal(formatTimeOpen("2026-09-12T13:59:30.000Z", now), "just now");
    assert.equal(formatTimeOpen("2026-09-12T13:59:00.000Z", now), "1 minute ago");
    assert.equal(formatTimeOpen("2026-09-12T13:40:00.000Z", now), "20 minutes ago");
    assert.equal(formatTimeOpen("2026-09-12T13:00:00.000Z", now), "1 hour ago");
    assert.equal(formatTimeOpen("2026-09-12T11:00:00.000Z", now), "3 hours ago");
  });

  it("formats day-scale values via daysBetween", () => {
    assert.equal(formatTimeOpen("2026-09-11T14:00:00.000Z", now), "1 day ago");
    assert.equal(formatTimeOpen("2026-09-09T14:00:00.000Z", now), "3 days ago");
  });

  it("returns an em dash for missing or invalid timestamps", () => {
    assert.equal(formatTimeOpen(null, now), "—");
    assert.equal(formatTimeOpen("not-a-date", now), "—");
  });
});
