import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ISSUE_ERROR_FALLBACK } from "./types";
import { issueErrorMessage } from "./error-message";

describe("issueErrorMessage", () => {
  it("returns error.message text", () => {
    assert.equal(issueErrorMessage({ message: "Upload failed." }), "Upload failed.");
  });

  it("falls back when the object has no message so the UI never renders {}", () => {
    assert.equal(issueErrorMessage({}), ISSUE_ERROR_FALLBACK);
    assert.equal(issueErrorMessage({ message: "" }), ISSUE_ERROR_FALLBACK);
    assert.equal(issueErrorMessage(null), ISSUE_ERROR_FALLBACK);
  });

  it("uses a non-empty string as-is", () => {
    assert.equal(issueErrorMessage("Please try again."), "Please try again.");
  });
});
