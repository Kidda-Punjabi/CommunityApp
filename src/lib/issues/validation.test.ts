import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ISSUE_IMAGE_PDF_MAX_BYTES,
  ISSUE_VIDEO_MAX_BYTES,
} from "./types";
import {
  validateIssueArea,
  validateIssueDescription,
  validateIssueFile,
  validateIssueFileCount,
} from "./validation";

describe("validateIssueArea", () => {
  it("requires a known area", () => {
    assert.equal(validateIssueArea(""), "Please choose an area.");
    assert.equal(validateIssueArea("homework"), null);
  });
});

describe("validateIssueDescription", () => {
  it("requires at least 10 characters after trimming", () => {
    assert.equal(validateIssueDescription("short"), "Please enter at least 10 characters.");
    assert.equal(validateIssueDescription("   hello there  "), null);
  });

  it("rejects more than 4000 characters", () => {
    assert.equal(
      validateIssueDescription("x".repeat(4001)),
      "Description must be 4000 characters or fewer."
    );
  });
});

describe("validateIssueFile", () => {
  it("rejects unsupported types", () => {
    assert.equal(
      validateIssueFile({ name: "notes.exe", type: "application/x-msdownload", size: 100 }),
      "That file type isn't supported. Please add an image, PDF, or short screen recording."
    );
  });

  it("rejects oversize images and PDFs", () => {
    assert.equal(
      validateIssueFile({
        name: "shot.png",
        type: "image/png",
        size: ISSUE_IMAGE_PDF_MAX_BYTES + 1,
      }),
      "Images and PDFs must be 10 MB or smaller."
    );
  });

  it("rejects oversize videos", () => {
    assert.equal(
      validateIssueFile({
        name: "clip.mp4",
        type: "video/mp4",
        size: ISSUE_VIDEO_MAX_BYTES + 1,
      }),
      "Videos must be 50 MB or smaller."
    );
  });

  it("accepts a supported image under the size limit", () => {
    assert.equal(
      validateIssueFile({ name: "shot.jpg", type: "image/jpeg", size: 1024 }),
      null
    );
  });
});

describe("validateIssueFileCount", () => {
  it("caps attachments at 5", () => {
    assert.equal(validateIssueFileCount(5, 1), "You can attach up to 5 files.");
    assert.equal(validateIssueFileCount(2, 2), null);
  });
});
