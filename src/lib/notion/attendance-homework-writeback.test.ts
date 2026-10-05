import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyLookupCount,
  logCoversQueueTarget,
  mergeRelationIds,
  relationPropertyForKind,
  shouldRetryFailed,
  uniqueNotionIds,
} from "./attendance-homework-writeback-logic";

describe("uniqueNotionIds", () => {
  it("dedupes hyphenated and compact UUIDs", () => {
    assert.deepEqual(
      uniqueNotionIds([
        "2b0b5ac4-29c6-8050-be7b-000b36600773",
        "2B0B5AC429C68050BE7B000B36600773",
        "abc",
      ]),
      ["2b0b5ac4-29c6-8050-be7b-000b36600773", "abc"]
    );
  });
});

describe("classifyLookupCount", () => {
  it("returns none / one / many", () => {
    assert.equal(classifyLookupCount([]), "none");
    assert.equal(classifyLookupCount(["page-a"]), "one");
    assert.equal(classifyLookupCount(["page-a", "page-b"]), "many");
  });
});

describe("mergeRelationIds", () => {
  it("appends without dropping existing ids", () => {
    const result = mergeRelationIds(["lead-1", "lead-2"], "lead-3");
    assert.equal(result.changed, true);
    assert.deepEqual(result.next, ["lead-1", "lead-2", "lead-3"]);
  });

  it("is a no-op when the lead is already present", () => {
    const result = mergeRelationIds(["lead-1", "lead-2"], "LEAD-1");
    assert.equal(result.changed, false);
    assert.deepEqual(result.next, ["lead-1", "lead-2"]);
  });
});

describe("logCoversQueueTarget", () => {
  const syncedApp = {
    cohortId: "cohort-1",
    packageInstanceId: null,
    lessonId: "lesson-1",
    source: "app",
    notionSyncStatus: "synced",
  };

  it("skips a cohort lesson the app already synced", () => {
    assert.equal(
      logCoversQueueTarget([syncedApp], {
        cohortId: "cohort-1",
        packageInstanceIds: [],
        lessonId: "lesson-1",
      }),
      true
    );
  });

  it("keeps homework and attendance for lessons that were not logged in the app", () => {
    assert.equal(
      logCoversQueueTarget([{ ...syncedApp, source: "notion" }], {
        cohortId: "cohort-1",
        packageInstanceIds: [],
        lessonId: "lesson-1",
      }),
      false
    );
    assert.equal(
      logCoversQueueTarget([syncedApp], {
        cohortId: "cohort-1",
        packageInstanceIds: [],
        lessonId: "lesson-2",
      }),
      false
    );
  });

  it("matches a 1-1 package when the queue row has no cohort", () => {
    assert.equal(
      logCoversQueueTarget(
        [
          {
            cohortId: null,
            packageInstanceId: "pkg-1",
            lessonId: "lesson-1",
            source: "app",
            notionSyncStatus: "synced",
          },
        ],
        { cohortId: null, packageInstanceIds: ["pkg-1"], lessonId: "lesson-1" }
      ),
      true
    );
  });
});

describe("relationPropertyForKind", () => {
  it("maps attendance to Attendees and homework to Homework", () => {
    assert.equal(relationPropertyForKind("attendance"), "Attendees");
    assert.equal(relationPropertyForKind("homework"), "Homework");
  });
});

describe("shouldRetryFailed", () => {
  it("retries below the cap and stops at 5", () => {
    assert.equal(shouldRetryFailed(0), true);
    assert.equal(shouldRetryFailed(4), true);
    assert.equal(shouldRetryFailed(5), false);
  });
});
