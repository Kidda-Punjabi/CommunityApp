import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTutorFeedbackAudioPath,
  parseTutorFeedbackAudio,
} from "./tutor-feedback-audio.ts";

const submissionId = "11111111-1111-4111-8111-111111111111";

test("builds a feedback path from the browser mime type", () => {
  assert.equal(
    buildTutorFeedbackAudioPath(submissionId, "audio/mp4", 1_700_000_000_000),
    `feedback/${submissionId}/1700000000000.m4a`
  );
  assert.equal(
    buildTutorFeedbackAudioPath(submissionId, "audio/webm;codecs=opus", 1_700_000_000_000),
    `feedback/${submissionId}/1700000000000.webm`
  );
});

test("accepts a voice note for that submission only", () => {
  const path = buildTutorFeedbackAudioPath(submissionId, "audio/webm", 1_700_000_000_000);
  assert.ok(path);
  assert.deepEqual(
    parseTutorFeedbackAudio(submissionId, {
      path,
      mimeType: "audio/webm;codecs=opus",
      durationSeconds: 20,
    }),
    { path, mimeType: "audio/webm;codecs=opus", durationSeconds: 20 }
  );
  assert.equal(
    parseTutorFeedbackAudio(submissionId, {
      path,
      mimeType: "audio/webm",
      durationSeconds: 121,
    }),
    null
  );
  assert.equal(
    parseTutorFeedbackAudio("22222222-2222-4222-8222-222222222222", {
      path,
      mimeType: "audio/webm",
      durationSeconds: 20,
    }),
    null
  );
});
