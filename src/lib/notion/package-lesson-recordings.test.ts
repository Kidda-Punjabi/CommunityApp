import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assessPackageLessonStructure,
  lessonDateFromNotionDate,
  planRecordingLinkFill,
  REQUIRED_LESSON_PROPERTIES,
} from "./package-lesson-recordings";

const matchingProperties = Object.fromEntries(
  Object.entries(REQUIRED_LESSON_PROPERTIES).map(([name, type]) => [name, type])
);

describe("assessPackageLessonStructure", () => {
  const okShape = {
    childPageCount: 1,
    inlineDatabasesOnPage: 0,
    inlineDatabaseCount: 1,
    dataSourceCount: 1,
    properties: matchingProperties,
  };

  it("accepts one child page, one inline database, and the expected properties", () => {
    assert.deepEqual(assessPackageLessonStructure(okShape), { ok: true });
  });

  it("skips a package page with no child page", () => {
    const result = assessPackageLessonStructure({ ...okShape, childPageCount: 0 });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "no child page");
  });

  it("records when the inline database sits on the package page itself", () => {
    const result = assessPackageLessonStructure({
      ...okShape,
      childPageCount: 0,
      inlineDatabasesOnPage: 1,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.reason, /no child page/);
      assert.match(result.reason, /package page/);
    }
  });

  it("skips several child pages or inline databases", () => {
    const pages = assessPackageLessonStructure({ ...okShape, childPageCount: 2 });
    const databases = assessPackageLessonStructure({ ...okShape, inlineDatabaseCount: 3 });
    assert.equal(pages.ok, false);
    assert.equal(databases.ok, false);
    if (!pages.ok) assert.match(pages.reason, /several child pages/);
    if (!databases.ok) assert.match(databases.reason, /several inline databases/);
  });

  it("skips different property names", () => {
    const result = assessPackageLessonStructure({
      ...okShape,
      properties: { ...matchingProperties, Recording: "rich_text" },
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /different property names/);
  });
});

describe("lessonDateFromNotionDate", () => {
  it("keeps a date-only value", () => {
    assert.equal(lessonDateFromNotionDate("2026-09-11"), "2026-09-11");
  });

  it("converts a timestamp to the London calendar date", () => {
    assert.equal(lessonDateFromNotionDate("2026-06-15T23:30:00.000Z"), "2026-06-16");
  });
});

describe("planRecordingLinkFill", () => {
  const entries = [
    { id: "a", lessonDate: "2026-09-11", recordingUrl: null },
    { id: "b", lessonDate: "2026-09-04", recordingUrl: "https://already.example/rec" },
  ];

  it("fills the single empty log row for that date", () => {
    assert.deepEqual(planRecordingLinkFill(entries, "2026-09-11", "https://fathom.video/share/abc"), {
      action: "fill",
      entryId: "a",
    });
  });

  it("does not overwrite a recording that is already set", () => {
    assert.deepEqual(planRecordingLinkFill(entries, "2026-09-04", "https://fathom.video/share/new"), {
      action: "already_set",
    });
  });

  it("leaves a row unmatched when the date hits more than one log entry", () => {
    const result = planRecordingLinkFill(
      [
        ...entries,
        { id: "c", lessonDate: "2026-09-11", recordingUrl: null },
      ],
      "2026-09-11",
      "https://fathom.video/share/abc"
    );
    assert.deepEqual(result, { action: "unmatched" });
  });
});
