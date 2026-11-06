import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  messageForMicrophoneFailure,
  safePracticeMessage,
} from "./microphone-access-message";

describe("messageForMicrophoneFailure", () => {
  it("replaces a browser permission denial with settings guidance", () => {
    const failure = messageForMicrophoneFailure({
      name: "NotAllowedError",
      message: "Permission denied",
    });
    assert.equal(failure.kind, "blocked");
    if (failure.kind !== "blocked") return;
    assert.match(failure.title, /Microphone access is blocked/);
    assert.match(failure.title, /kidda\.app/);
    assert.match(failure.iphone, /iPhone/);
    assert.match(failure.chrome, /Chrome/);
    assert.equal(JSON.stringify(failure).includes("Permission denied"), false);
  });

  it("does not treat a missing microphone as a permanent permission block", () => {
    const failure = messageForMicrophoneFailure({ name: "NotFoundError", message: "Device not found" });
    assert.equal(failure.kind, "message");
    if (failure.kind !== "message") return;
    assert.equal(failure.message.includes("Device not found"), false);
  });
});

describe("safePracticeMessage", () => {
  it("hides raw permission and database errors", () => {
    assert.equal(
      safePracticeMessage("permission denied for table speaking_practice_attempts", "Try again."),
      "Try again."
    );
    assert.equal(safePracticeMessage("No speech detected", "Try again."), "No speech detected");
  });
});

describe("microphoneFailureType", () => {
  it("labels each browser error for logging", async () => {
    const { microphoneFailureType } = await import("./microphone-access-message");
    assert.equal(microphoneFailureType({ name: "NotAllowedError" }), "permission_denied");
    assert.equal(microphoneFailureType({ name: "NotFoundError" }), "no_device");
    assert.equal(microphoneFailureType({ name: "NotReadableError" }), "device_busy");
    assert.equal(microphoneFailureType({ name: "NotSupportedError" }), "unsupported");
    assert.equal(microphoneFailureType({ name: "Weird" }), "unknown");
  });
});
