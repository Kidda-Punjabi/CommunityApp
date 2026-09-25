import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  avatarObjectPath,
  avatarObjectPathForUser,
  mediaSrc,
  parsePublicStorageUrl,
  retainAvatarCacheBust,
} from "./signed-media";

describe("mediaSrc", () => {
  it("rewrites lesson-log-media public URLs to the signed proxy", () => {
    const url =
      "https://pztubczhqkzcwtkstpgi.supabase.co/storage/v1/object/public/lesson-log-media/123-abc.mp4";
    assert.equal(
      mediaSrc(url),
      "/api/media/lesson-log-media/123-abc.mp4"
    );
  });

  it("leaves Fathom and other external recording links unchanged", () => {
    const fathom = "https://fathom.video/share/abc123";
    assert.equal(mediaSrc(fathom), fathom);
    assert.equal(parsePublicStorageUrl(fathom), null);
  });

  it("leaves intentionally public CMS buckets unchanged", () => {
    const pdf =
      "https://pztubczhqkzcwtkstpgi.supabase.co/storage/v1/object/public/lesson-pdfs/week1.pdf";
    assert.equal(mediaSrc(pdf), pdf);
  });

  it("rewrites a stored avatar path to the signed proxy", () => {
    const path = "d99dbb59-243b-47ba-880f-b07fa50cc1ed/profile.jpg";
    assert.equal(
      mediaSrc(path),
      "/api/media/avatars/d99dbb59-243b-47ba-880f-b07fa50cc1ed/profile.jpg"
    );
  });

  it("rewrites a legacy public avatar URL and keeps a cache-buster", () => {
    const url =
      "https://pztubczhqkzcwtkstpgi.supabase.co/storage/v1/object/public/avatars/9967ceda-f077-4430-83b5-3198db006550/profile.png?v=1";
    assert.equal(
      mediaSrc(url),
      "/api/media/avatars/9967ceda-f077-4430-83b5-3198db006550/profile.png?v=1"
    );
    assert.equal(
      avatarObjectPath(url),
      "9967ceda-f077-4430-83b5-3198db006550/profile.png"
    );
  });

  it("rejects another user's avatar path", () => {
    const path = "d99dbb59-243b-47ba-880f-b07fa50cc1ed/profile.jpg";
    assert.equal(avatarObjectPathForUser("someone-else", path), null);
    assert.equal(avatarObjectPathForUser("d99dbb59-243b-47ba-880f-b07fa50cc1ed", path), path);
  });

  it("keeps a fresh upload cache-buster when the stored path matches", () => {
    const stored = "d99dbb59-243b-47ba-880f-b07fa50cc1ed/profile.jpg";
    const preview = `${stored}?v=10`;
    assert.equal(retainAvatarCacheBust(preview, stored), preview);
    assert.equal(retainAvatarCacheBust(preview, null), null);
  });
});
