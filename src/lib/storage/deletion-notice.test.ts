import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addIsoDays, daysUntil, londonDateIso, planDeletionNotice } from "./deletion-notice";

describe("deletion notices", () => {
  it("uses the London calendar date", () => {
    assert.equal(londonDateIso(new Date("2026-10-19T23:30:00Z")), "2026-10-20");
    assert.equal(addIsoDays("2026-10-19", 14), "2026-11-02");
    assert.equal(daysUntil("2026-10-19", "2026-11-02"), 14);
  });

  it("sends the 14-day notice before a deletion date exists", () => {
    assert.deepEqual(
      planDeletionNotice({ today: "2026-10-19", deleteOn: null, sent14: false, sent3On: null }),
      { action: "send14", deleteOn: "2026-11-02" }
    );
  });

  it("waits, then sends the 3-day notice, then deletes", () => {
    assert.equal(
      planDeletionNotice({
        today: "2026-10-20",
        deleteOn: "2026-11-02",
        sent14: true,
        sent3On: null,
      }).action,
      "wait"
    );
    assert.deepEqual(
      planDeletionNotice({
        today: "2026-10-30",
        deleteOn: "2026-11-02",
        sent14: true,
        sent3On: null,
      }),
      { action: "send3", deleteOn: "2026-11-02" }
    );
    assert.equal(
      planDeletionNotice({
        today: "2026-11-02",
        deleteOn: "2026-11-02",
        sent14: true,
        sent3On: "2026-10-30",
      }).action,
      "delete"
    );
  });

  it("does not delete on the same day as a late 3-day notice", () => {
    assert.deepEqual(
      planDeletionNotice({
        today: "2026-11-02",
        deleteOn: "2026-11-02",
        sent14: true,
        sent3On: null,
      }),
      { action: "send3", deleteOn: "2026-11-05" }
    );
    assert.equal(
      planDeletionNotice({
        today: "2026-11-04",
        deleteOn: "2026-11-05",
        sent14: true,
        sent3On: "2026-11-02",
      }).action,
      "wait"
    );
  });
});
