import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { feedbackPhotoObjectPath } from "./feedback-photo-path";

describe("feedback photo paths", () => {
  it("reads the object path from a public storage URL", () => {
    assert.equal(
      feedbackPhotoObjectPath(
        "https://pztubczhqkzcwtkstpgi.supabase.co/storage/v1/object/public/feedback-photos/guest/photo.png?v=1"
      ),
      "guest/photo.png"
    );
  });

  it("keeps a bare bucket path and ignores other urls", () => {
    assert.equal(feedbackPhotoObjectPath("parent/kid.png"), "parent/kid.png");
    assert.equal(feedbackPhotoObjectPath("https://example.com/photo.png"), null);
    assert.equal(feedbackPhotoObjectPath("../secret.png"), null);
  });
});
