import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeLessonLogPagesById,
  nextLessonLogWatermark,
} from "./lesson-log-watermark";

describe("nextLessonLogWatermark", () => {
  it("does not advance when every page failed", () => {
    assert.equal(nextLessonLogWatermark("2026-09-15T21:58:00.000Z", []), "2026-09-15T21:58:00.000Z");
  });

  it("advances only to the newest successful last_edited_time", () => {
    assert.equal(
      nextLessonLogWatermark("2026-09-15T21:58:00.000Z", [
        "2026-09-16T09:00:00.000Z",
        "2026-09-16T08:50:00.000Z",
      ]),
      "2026-09-16T09:00:00.000Z"
    );
  });

  it("does not rewind when successes are older than the stored watermark", () => {
    assert.equal(
      nextLessonLogWatermark("2026-09-16T09:00:00.000Z", ["2026-09-15T21:58:00.000Z"]),
      "2026-09-16T09:00:00.000Z"
    );
  });
});

describe("mergeLessonLogPagesById", () => {
  it("keeps the newer last_edited_time when a retry overlaps an incremental page", () => {
    const merged = mergeLessonLogPagesById(
      [{ pageId: "a", lastEditedTime: "2026-09-16T09:00:00.000Z" }],
      [{ pageId: "a", lastEditedTime: "2026-09-16T09:10:00.000Z" }, { pageId: "b", lastEditedTime: "2026-09-15T12:00:00.000Z" }]
    );
    const byId = new Map(merged.map((page) => [page.pageId, page]));
    assert.equal(byId.get("a")?.lastEditedTime, "2026-09-16T09:10:00.000Z");
    assert.equal(byId.get("b")?.lastEditedTime, "2026-09-15T12:00:00.000Z");
  });
});
