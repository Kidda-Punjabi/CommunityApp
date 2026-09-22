import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CourseActor } from "@/lib/kids/course-actor";
import {
  buildHomeworkRecordingStoragePath,
  isOwnHomeworkRecordingPath,
} from "./homework-recording-upload";

const ADULT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";
const KID_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_KID_ID = "44444444-4444-4444-8444-444444444444";

const adult: CourseActor = { kind: "user", userId: ADULT_ID, kidProfileId: null };
const kid: CourseActor = { kind: "kid", userId: ADULT_ID, kidProfileId: KID_ID };

describe("homework recording upload paths", () => {
  it("builds an adult path under the authenticated user and self", () => {
    const path = buildHomeworkRecordingStoragePath(adult, "audio/webm;codecs=opus", 1_700_000_000_000);
    assert.equal(path, `${ADULT_ID}/self/1700000000000.webm`);
  });

  it("builds a kid path under the parent account and that kid profile", () => {
    const path = buildHomeworkRecordingStoragePath(kid, "audio/mp4", 42);
    assert.equal(path, `${ADULT_ID}/${KID_ID}/42.m4a`);
  });

  it("accepts only the actor's own folder", () => {
    const own = `${ADULT_ID}/self/1700000000000.webm`;
    assert.equal(isOwnHomeworkRecordingPath(adult, own), true);
    assert.equal(isOwnHomeworkRecordingPath(kid, own), false);
  });

  it("rejects a path whose first segment is another student", () => {
    const foreign = `${OTHER_ID}/self/1700000000000.webm`;
    assert.equal(isOwnHomeworkRecordingPath(adult, foreign), false);
    assert.equal(isOwnHomeworkRecordingPath(kid, `${OTHER_ID}/${KID_ID}/1700000000000.webm`), false);
  });

  it("rejects another kid profile under the same parent", () => {
    const otherKid = `${ADULT_ID}/${OTHER_KID_ID}/1700000000000.webm`;
    assert.equal(isOwnHomeworkRecordingPath(kid, otherKid), false);
  });

  it("rejects traversal, extra segments, and non-audio names", () => {
    assert.equal(
      isOwnHomeworkRecordingPath(adult, `${ADULT_ID}/self/../${OTHER_ID}/self/1.webm`),
      false
    );
    assert.equal(isOwnHomeworkRecordingPath(adult, `${ADULT_ID}/self/1.webm/extra`), false);
    assert.equal(isOwnHomeworkRecordingPath(adult, `${ADULT_ID}/self/1.html`), false);
    assert.equal(isOwnHomeworkRecordingPath(adult, `${OTHER_ID}/self/1.webm`), false);
  });
});
