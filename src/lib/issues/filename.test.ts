import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeIssueFilename } from "./filename";

describe("sanitizeIssueFilename", () => {
  it("strips path characters and keeps the extension", () => {
    assert.equal(sanitizeIssueFilename("../../etc/passwd.png"), "passwd.png");
    assert.equal(sanitizeIssueFilename("folder\\shot.mov"), "shot.mov");
  });

  it("replaces reserved filename characters", () => {
    assert.equal(sanitizeIssueFilename("bad:name?.pdf"), "bad_name_.pdf");
  });

  it("avoids duplicate names in the same report", () => {
    const used = new Set<string>();
    assert.equal(sanitizeIssueFilename("note.pdf", used), "note.pdf");
    assert.equal(sanitizeIssueFilename("note.pdf", used), "note-2.pdf");
  });
});
