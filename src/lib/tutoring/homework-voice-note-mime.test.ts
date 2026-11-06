import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { homeworkVoiceNoteMime } from "./homework-recording-upload";

describe("homeworkVoiceNoteMime", () => {
  it("accepts WhatsApp opus exports with no browser type", () => {
    assert.equal(homeworkVoiceNoteMime("PTT-20261106-WA0001.opus", ""), "audio/ogg");
    assert.equal(homeworkVoiceNoteMime("voice.opus", "application/octet-stream"), "audio/ogg");
    assert.equal(homeworkVoiceNoteMime("voice.ogg", "audio/ogg"), "audio/ogg");
  });

  it("maps iPhone voice memos to audio/mp4", () => {
    assert.equal(homeworkVoiceNoteMime("New Recording.m4a", "audio/x-m4a"), "audio/mp4");
    assert.equal(homeworkVoiceNoteMime("New Recording.m4a", ""), "audio/mp4");
  });

  it("keeps the other supported formats", () => {
    assert.equal(homeworkVoiceNoteMime("a.mp3", "audio/mpeg"), "audio/mpeg");
    assert.equal(homeworkVoiceNoteMime("a.wav", "audio/wav"), "audio/wav");
    assert.equal(homeworkVoiceNoteMime("a.webm", "audio/webm"), "audio/webm");
  });

  it("rejects files that are not audio", () => {
    assert.equal(homeworkVoiceNoteMime("photo.jpg", "image/jpeg"), null);
    assert.equal(homeworkVoiceNoteMime("notes.pdf", ""), null);
  });
});
