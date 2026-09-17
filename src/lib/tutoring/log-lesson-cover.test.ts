import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveLogLessonCoverOverride } from "./log-lesson-cover";

describe("resolveLogLessonCoverOverride", () => {
  it("keeps the logger's Notion tutor id when the cover checkbox is off", () => {
    assert.deepEqual(
      resolveLogLessonCoverOverride({
        isCoverSession: false,
        selectedCoverTutorNotionUserId: "picked-tutor",
        loggerNotionUserId: "logger-tutor",
      }),
      { ok: true, isCoverSession: false, notionTutorUserId: "logger-tutor" }
    );
  });

  it("leaves Actual Tutor blank when the logger has no map row", () => {
    assert.deepEqual(
      resolveLogLessonCoverOverride({
        isCoverSession: false,
        selectedCoverTutorNotionUserId: "picked-tutor",
        loggerNotionUserId: null,
      }),
      { ok: true, isCoverSession: false, notionTutorUserId: null }
    );
  });

  it("uses the picked tutor and marks cover when the checkbox is on", () => {
    assert.deepEqual(
      resolveLogLessonCoverOverride({
        isCoverSession: true,
        selectedCoverTutorNotionUserId: "  picked-tutor  ",
        loggerNotionUserId: "logger-tutor",
      }),
      { ok: true, isCoverSession: true, notionTutorUserId: "picked-tutor" }
    );
  });

  it("rejects a cover log with no tutor selected", () => {
    assert.deepEqual(
      resolveLogLessonCoverOverride({
        isCoverSession: true,
        selectedCoverTutorNotionUserId: "  ",
        loggerNotionUserId: "logger-tutor",
      }),
      { ok: false, error: "Choose who you covered for." }
    );
  });
});
