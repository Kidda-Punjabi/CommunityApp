import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lastUserFromAuthMetadata, parseLastUser, serializeLastUser } from "./last-user";

describe("last user cookie", () => {
  it("does not write an avatar URL", () => {
    const serialized = serializeLastUser({
      email: "ada@example.com",
      displayName: "Ada",
      avatarUrl: "https://example.com/photo.jpg",
    });
    assert.equal(serialized.includes("avatar"), false);
    assert.deepEqual(JSON.parse(serialized), {
      email: "ada@example.com",
      displayName: "Ada",
    });
  });

  it("ignores an avatar URL already stored in the cookie", () => {
    const parsed = parseLastUser(
      JSON.stringify({
        email: "ada@example.com",
        displayName: "Ada",
        avatarUrl: "https://example.supabase.co/storage/v1/object/public/avatars/id/profile.jpg",
      })
    );
    assert.equal(parsed?.avatarUrl, null);
    assert.equal(parsed?.displayName, "Ada");
  });

  it("does not copy avatar_url out of auth metadata", () => {
    const payload = lastUserFromAuthMetadata({
      email: "ada@example.com",
      user_metadata: {
        full_name: "Ada Lovelace",
        avatar_url: "ada/profile.jpg",
      },
    });
    assert.equal(payload?.avatarUrl, null);
    assert.equal(payload?.displayName, "Ada");
  });
});
